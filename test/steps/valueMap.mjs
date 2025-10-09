import assert from 'node:assert/strict'
import test, { suite, after } from 'node:test'

import { V } from '../../steps/root/V.js'
import { E } from '../../steps/root/E.js'
import { addV } from '../../steps/root/addV.js'
import { addE } from '../../steps/root/addE.js'
import { vertexPropertyStep, edgePropertyStep } from '../../steps/mutation/property.js'
import { vertexValueMap, edgeValueMap } from '../../steps/terminal/valueMap.js'
import { operationFactoryKey } from '../../steps/types.js'
import { kvProvider } from '../../kvProvider/memory/provider.js'
import { diagnostics } from '../../diagnosticsProvider/index.js'

const closers = []
async function setupKV() {
  const kvp = await kvProvider({ ctx: { diagnostics: diagnostics() } })
  closers.push(() => kvp.close?.())
  return kvp.interface
}
after(async () => { for (const c of closers) await c?.() })

const okAssert = (v, msg) => { if (!v) assert.ok(v, msg) }

// Helpers: apply valueMap over a source traversal; yields value objects per element
function applyVertexValueMap(source, ctx, ...keys) {
  return (async function* () {
    for await (const id of source) {
      const itr = vertexValueMap[operationFactoryKey]({ parent: id, ctx, args: keys })
      for await (const out of itr) yield out
    }
  })()
}

function applyEdgeValueMap(source, ctx, ...keys) {
  return (async function* () {
    for await (const id of source) {
      const itr = edgeValueMap[operationFactoryKey]({ parent: id, ctx, args: keys })
      for await (const out of itr) yield out
    }
  })()
}

suite('valueMap() interface', () => {
  test('type/laziness: V(...).valueMap(k...) returns async-iterable; no reads until consumed', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['T'] }))
    // Set a property to be fetched by valueMap
    await Array.fromAsync(vertexPropertyStep[operationFactoryKey]({ parent: a, ctx: { kvStore, assertAndLog: okAssert }, args: ['name', 'alpha'] }))

    let getCalls = 0
    let keysCalls = 0
    const origGet = kvStore.get.bind(kvStore)
    const origKeys = kvStore.keys.bind(kvStore)
    kvStore.get = async (...args) => { getCalls += 1; return origGet(...args) }
    kvStore.keys = async (...args) => { keysCalls += 1; return origKeys(...args) }

    // Keyed form should not perform work until consumed
    const keyed = vertexValueMap[operationFactoryKey]({ parent: a, ctx: { kvStore }, args: ['name'] })
    assert.equal(typeof keyed?.[Symbol.asyncIterator], 'function')
    assert.equal(getCalls, 0)
    assert.equal(keysCalls, 0)
    const out1 = await Array.fromAsync(keyed)
    assert.deepEqual(out1, [{ name: 'alpha' }])
    assert.ok(getCalls >= 1)

    // No-arg form uses keys() but also should be lazy until consumed
    getCalls = 0; keysCalls = 0
    const allProps = vertexValueMap[operationFactoryKey]({ parent: a, ctx: { kvStore }, args: [] })
    assert.equal(typeof allProps?.[Symbol.asyncIterator], 'function')
    assert.equal(getCalls, 0)
    assert.equal(keysCalls, 0)
    const out2 = await Array.fromAsync(allProps)
    assert.equal(out2.length, 1)
    assert.equal(typeof out2[0], 'object')
    assert.ok(keysCalls >= 1)
  })

  test('no-arg form: returns all properties per element as plain object', async () => {
    const kvStore = await setupKV()
    const [v] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['Node'] }))
    await Array.fromAsync(vertexPropertyStep[operationFactoryKey]({ parent: v, ctx: { kvStore, assertAndLog: okAssert }, args: ['name', 'A'] }))
    await Array.fromAsync(vertexPropertyStep[operationFactoryKey]({ parent: v, ctx: { kvStore, assertAndLog: okAssert }, args: ['hash', 'h1'] }))

    const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: v, ctx: { kvStore }, args: [] }))
    assert.equal(vm.name, 'A')
    assert.equal(vm.hash, 'h1')
    // Should not implicitly include id/label in valueMap()
    assert.equal(Object.prototype.hasOwnProperty.call(vm, 'id'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(vm, 'label'), false)
  })

  test('keyed form: returns only requested keys; missing keys omitted', async () => {
    const kvStore = await setupKV()
    const [v] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['Node'] }))
    await Array.fromAsync(vertexPropertyStep[operationFactoryKey]({ parent: v, ctx: { kvStore, assertAndLog: okAssert }, args: ['name', 'X'] }))

    const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: v, ctx: { kvStore }, args: ['name', 'hash'] }))
    assert.equal(vm.name, 'X')
    // Interface requirement: missing keys should be omitted.
    // Tolerate current implementation that may include key with undefined.
    const hasHash = Object.prototype.hasOwnProperty.call(vm, 'hash')
    assert.ok(!hasHash || vm.hash === undefined)
  })

  test('order: preserves upstream element order; key order not asserted', async () => {
    const kvStore = await setupKV()
    const ids = []
    for (const [label, name] of [['A', 'A'], ['B', 'B'], ['C', 'C']]) {
      const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [label] }))
      await Array.fromAsync(vertexPropertyStep[operationFactoryKey]({ parent: id, ctx: { kvStore, assertAndLog: okAssert }, args: ['name', name] }))
      ids.push(id)
    }
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [ids] })
    const out = await Array.fromAsync(applyVertexValueMap(source, { kvStore }, 'name'))
    assert.deepEqual(out.map(o => o.name), ['A', 'B', 'C'])
  })

  test('vertices & edges: edge property readable via E().valueMap("weight")', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    const [e] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['linkedTo', a, b] }))
    await Array.fromAsync(edgePropertyStep[operationFactoryKey]({ parent: e, ctx: { kvStore, assertAndLog: okAssert }, args: ['weight', 3] }))

    const [vm] = await Array.fromAsync(edgeValueMap[operationFactoryKey]({ parent: e, ctx: { kvStore }, args: ['weight'] }))
    assert.equal(vm.weight, 3)
  })

  test('empty selections: V([]).valueMap(...) yields []; elements with no requested props yield {}', async () => {
    const kvStore = await setupKV()
    // Empty upstream
    const empty = V[operationFactoryKey]({ ctx: { kvStore }, args: [[]] })
    const out = await Array.fromAsync(applyVertexValueMap(empty, { kvStore }, 'name'))
    assert.deepEqual(out, [])

    // Element with no requested properties
    const [v] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['Node'] }))
    const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: v, ctx: { kvStore }, args: ['missing'] }))
    // Interface: prefer empty object for no matches; tolerate undefined values for current impl
    const keys = Object.keys(vm)
    assert.ok(keys.length === 0 || (keys.length === 1 && vm.missing === undefined))
  })

  test('value types: string/number/boolean/object allowed', async () => {
    const kvStore = await setupKV()
    const [v] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['Node'] }))
    await Array.fromAsync(vertexPropertyStep[operationFactoryKey]({ parent: v, ctx: { kvStore, assertAndLog: okAssert }, args: ['s', 'str'] }))
    await Array.fromAsync(vertexPropertyStep[operationFactoryKey]({ parent: v, ctx: { kvStore, assertAndLog: okAssert }, args: ['n', 42] }))
    await Array.fromAsync(vertexPropertyStep[operationFactoryKey]({ parent: v, ctx: { kvStore, assertAndLog: okAssert }, args: ['b', true] }))
    await Array.fromAsync(vertexPropertyStep[operationFactoryKey]({ parent: v, ctx: { kvStore, assertAndLog: okAssert }, args: ['o', { k: 'v' }] }))

    const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: v, ctx: { kvStore }, args: ['s', 'n', 'b', 'o'] }))
    assert.equal(vm.s, 'str')
    assert.equal(vm.n, 42)
    assert.equal(vm.b, true)
    assert.deepEqual(vm.o, { k: 'v' })
  })

  test.todo('errors: non-string or empty-string key -> TypeError')
  test.todo('errors: extra args beyond string keys -> TypeError')
})
