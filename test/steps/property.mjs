import assert from 'node:assert/strict'
import test, { suite, after } from 'node:test'

import { V } from '../../steps/root/V.js'
import { E } from '../../steps/root/E.js'
import { addV } from '../../steps/root/addV.js'
import { addE } from '../../steps/root/addE.js'
import { vertexProperties } from '../../steps/shelved/properties.js'
import { vertexPropertyStep, edgePropertyStep } from '../../steps/mutation/property.js'
import { vertexValueMap, edgeValueMap } from '../../steps/terminal/valueMap.js'
import { operationFactoryKey, Errors } from '../../steps/types.js'
import { kvProvider } from '../../kvProvider/memory/provider.js'
import { diagnostics } from '../../diagnosticsProvider/index.js'

const closers = []
async function setupKV() {
  const kvp = await kvProvider({ ctx: { diagnostics: diagnostics() } })
  closers.push(() => kvp.close?.())
  return kvp.interface
}
after(async () => { for (const c of closers) await c?.() })

const diags = () => diagnostics()

// Helper: apply vertex property over a source traversal; yields same ids
function applyVertexProperty(source, ctx, k, v) {
  return (async function* () {
    for await (const id of source) {
      const itr = vertexPropertyStep[operationFactoryKey]({ parent: id, ctx, args: [k, v] })
      for await (const out of itr) yield out
    }
  })()
}

// Helper: apply edge property over a source traversal; yields same ids
function applyEdgeProperty(source, ctx, k, v) {
  return (async function* () {
    for await (const id of source) {
      const itr = edgePropertyStep[operationFactoryKey]({ parent: id, ctx, args: [k, v] })
      for await (const out of itr) yield out
    }
  })()
}

suite('property() interface', () => {
  test('type/laziness: V(...).property(k,v) returns async-iterable; no write until consumed', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['T'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['T'] }))

    let updateCalls = 0
    const origUpdate = kvStore.update.bind(kvStore)
    kvStore.update = async (...args) => { updateCalls += 1; return origUpdate(...args) }

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a, b]] })
    const setName = applyVertexProperty(source, { kvStore, diagnostics: diags() }, 'name', 'alpha')
    assert.equal(typeof setName?.[Symbol.asyncIterator], 'function')
    assert.equal(updateCalls, 0)

    const out = await Array.fromAsync(setName)
    assert.deepEqual(out, [a, b])
    assert.equal(updateCalls, 2)
  })

  test.skip('set on vertices: property("name","alpha") is readable via valueMap("name")/properties("name")', async () => {
    const kvStore = await setupKV()
    const ids = []
    for (let i = 0; i < 3; i++) {
      const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['Node'] }))
      ids.push(id)
    }
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [ids] })
    await Array.fromAsync(applyVertexProperty(source, { kvStore, diagnostics: diags() }, 'name', 'alpha'))

    for (const id of ids) {
      const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: id, ctx: { kvStore }, args: ['name'] }))
      assert.equal(vm.name, 'alpha')

      const [props] = await Array.fromAsync(vertexProperties[operationFactoryKey]({ parent: id, ctx: { kvStore }, args: ['name'] }))
      assert.equal(props.name, 'alpha')
    }
  })

  test('set on edges: addE(...).property("weight",3) is readable via E().valueMap("weight")', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['X'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['Y'] }))
    const [e] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['dependsOn', a, b] }))

    const src = E[operationFactoryKey]({ ctx: { kvStore }, args: [[e]] })
    await Array.fromAsync(applyEdgeProperty(src, { kvStore, diagnostics: diags() }, 'weight', 3))

    const [vm] = await Array.fromAsync(edgeValueMap[operationFactoryKey]({ parent: e, ctx: { kvStore }, args: ['weight'] }))
    assert.equal(vm.weight, 3)
  })

  test('chaining: property("a",1).property("b",2) persists both', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['C'] }))
    const src = V[operationFactoryKey]({ ctx: { kvStore }, args: [[id]] })
    const pA = applyVertexProperty(src, { kvStore, diagnostics: diags() }, 'a', 1)
    const pB = applyVertexProperty(pA, { kvStore, diagnostics: diags() }, 'b', 2)
    const out = await Array.fromAsync(pB)
    assert.deepEqual(out, [id])

    const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: id, ctx: { kvStore }, args: ['a', 'b'] }))
    assert.equal(vm.a, 1)
    assert.equal(vm.b, 2)
  })

  test('bulk apply: V(idA,idB).property("flag",true) sets both; yields same ids', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['T'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['T'] }))
    const src = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a, b]] })
    const setFlag = applyVertexProperty(src, { kvStore, diagnostics: diags() }, 'flag', true)
    const out = await Array.fromAsync(setFlag)
    assert.deepEqual(out, [a, b])

    for (const id of [a, b]) {
      const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: id, ctx: { kvStore }, args: ['flag'] }))
      assert.equal(vm.flag, true)
    }
  })

  test('overwrite single-cardinality: setting count=1 then 2 leaves final value 2', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['C'] }))
    const src = V[operationFactoryKey]({ ctx: { kvStore }, args: [[id]] })
    await Array.fromAsync(applyVertexProperty(src, { kvStore, diagnostics: diags() }, 'count', 1))
    await Array.fromAsync(applyVertexProperty(src, { kvStore, diagnostics: diags() }, 'count', 2))

    const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: id, ctx: { kvStore }, args: ['count'] }))
    assert.equal(vm.count, 2)
  })

  test('value types: accept string/number/boolean/object; reject undefined/functions/symbols', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['V'] }))
    const src = V[operationFactoryKey]({ ctx: { kvStore }, args: [[id]] })

    // Acceptable types
    await Array.fromAsync(applyVertexProperty(src, { kvStore, diagnostics: diags() }, 's', 'str'))
    await Array.fromAsync(applyVertexProperty(src, { kvStore, diagnostics: diags() }, 'n', 42))
    await Array.fromAsync(applyVertexProperty(src, { kvStore, diagnostics: diags() }, 'b', false))
    await Array.fromAsync(applyVertexProperty(src, { kvStore, diagnostics: diags() }, 'o', { x: 1 }))

    const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: id, ctx: { kvStore }, args: ['s', 'n', 'b', 'o'] }))
    assert.equal(vm.s, 'str')
    assert.equal(vm.n, 42)
    assert.equal(vm.b, false)
    assert.deepEqual(vm.o, { x: 1 })

    // Rejected types (JSON.stringify -> undefined => kv.update TypeError)
    const bads = [undefined, () => { }, Symbol('x')]
    for (const bad of bads) {
      const t = applyVertexProperty(src, { kvStore, diagnostics: diags() }, 'bad', bad)
      await assert.rejects(() => Array.fromAsync(t))
    }
  })

  test('errors: missing args; one arg only; non-string/empty key; undefined value -> diagnostics errors', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['T'] }))
    const src = V[operationFactoryKey]({ ctx: { kvStore }, args: [[id]] })

    // Missing args (both k and v undefined)
    const t0 = applyVertexProperty(src, { kvStore, diagnostics: diags() }, undefined, undefined)
    await assert.rejects(() => Array.fromAsync(t0), (err) => err?.code === Errors.PROPERTY_INVALID_KEY)

    // One arg only (value undefined)
    const t1 = applyVertexProperty(src, { kvStore, diagnostics: diags() }, 'x', undefined)
    await assert.rejects(() => Array.fromAsync(t1), (err) => err?.code === Errors.PROPERTY_INVALID_VALUE)

    // Non-string key (Symbol) -> TypeError when constructing path
    const t2 = applyVertexProperty(src, { kvStore, diagnostics: diags() }, Symbol('k'), 'v')
    await assert.rejects(() => Array.fromAsync(t2), (err) => err?.code === Errors.PROPERTY_INVALID_KEY)

    // Empty key -> expected TypeError by contract
    const t3 = applyVertexProperty(src, { kvStore, diagnostics: diags() }, '', 'v')
    await assert.rejects(() => Array.fromAsync(t3), (err) => err?.code === Errors.PROPERTY_INVALID_KEY)
  })

  test('errors: reserved keys on vertices are rejected with PROPERTY_RESERVED_KEY', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['T'] }))
    const src = V[operationFactoryKey]({ ctx: { kvStore }, args: [[id]] })

    const tId = applyVertexProperty(src, { kvStore, diagnostics: diags() }, 'id', 'x')
    await assert.rejects(() => Array.fromAsync(tId), (err) => err?.code === Errors.PROPERTY_RESERVED_KEY)

    const tLabel = applyVertexProperty(src, { kvStore, diagnostics: diags() }, 'label', 'x')
    await assert.rejects(() => Array.fromAsync(tLabel), (err) => err?.code === Errors.PROPERTY_RESERVED_KEY)
  })

  test('errors: reserved keys on edges are rejected with PROPERTY_RESERVED_KEY', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['B'] }))
    const [e] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['t', a, b] }))

    const src = E[operationFactoryKey]({ ctx: { kvStore }, args: [[e]] })
    const pId = applyEdgeProperty(src, { kvStore, diagnostics: diags() }, 'id', 'x')
    await assert.rejects(() => Array.fromAsync(pId), (err) => err?.code === Errors.PROPERTY_RESERVED_KEY)

    const pLabel = applyEdgeProperty(src, { kvStore, diagnostics: diags() }, 'label', 'x')
    await assert.rejects(() => Array.fromAsync(pLabel), (err) => err?.code === Errors.PROPERTY_RESERVED_KEY)
  })

  test('no-ops: operating on an empty traversal yields empty iterator with no error', async () => {
    const kvStore = await setupKV()
    const src = V[operationFactoryKey]({ ctx: { kvStore }, args: [[]] }) // empty list
    const t = applyVertexProperty(src, { kvStore, diagnostics: diags() }, 'x', 1)
    const out = await Array.fromAsync(t)
    assert.deepEqual(out, [])
  })
})
