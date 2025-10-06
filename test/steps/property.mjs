import assert from 'node:assert/strict'
import test, { suite } from 'node:test'

import { V } from '../../steps/root/V.js'
import { E } from '../../steps/root/E.js'
import { addV } from '../../steps/root/addV.js'
import { addE } from '../../steps/root/addE.js'
import { vertexProperties } from '../../steps/shelved/properties.js'
import { vertexPropertyStep, edgePropertyStep } from '../../steps/mutation/property.js'
import { vertexValueMap, edgeValueMap } from '../../steps/terminal/valueMap.js'
import { operationFactoryKey } from '../../steps/types.js'
import { kvProvider } from '../../kvProvider/memory/provider.js'

async function setupKV() {
  const { interface: kvStore } = await kvProvider()
  return kvStore
}

const okAssert = (v, msg) => { if (!v) assert.ok(v, msg) }
const typeErrAssert = (v, msg) => { if (!v) throw new TypeError(msg) }

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
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['T'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['T'] }))

    let updateCalls = 0
    const origUpdate = kvStore.update.bind(kvStore)
    kvStore.update = async (...args) => { updateCalls += 1; return origUpdate(...args) }

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a, b]] })
    const setName = applyVertexProperty(source, { kvStore, assertAndLog: okAssert }, 'name', 'alpha')
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
      const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['Node'] }))
      ids.push(id)
    }
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [ids] })
    await Array.fromAsync(applyVertexProperty(source, { kvStore, assertAndLog: okAssert }, 'name', 'alpha'))

    for (const id of ids) {
      const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: id, ctx: { kvStore }, args: ['name'] }))
      assert.equal(vm.name, 'alpha')

      const [props] = await Array.fromAsync(vertexProperties[operationFactoryKey]({ parent: id, ctx: { kvStore }, args: ['name'] }))
      assert.equal(props.name, 'alpha')
    }
  })

  test('set on edges: addE(...).property("weight",3) is readable via E().valueMap("weight")', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['X'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['Y'] }))
    const [e] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['dependsOn', a, b] }))

    const src = E[operationFactoryKey]({ ctx: { kvStore }, args: [[e]] })
    await Array.fromAsync(applyEdgeProperty(src, { kvStore, assertAndLog: okAssert }, 'weight', 3))

    const [vm] = await Array.fromAsync(edgeValueMap[operationFactoryKey]({ parent: e, ctx: { kvStore }, args: ['weight'] }))
    assert.equal(vm.weight, 3)
  })

  test('chaining: property("a",1).property("b",2) persists both', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['C'] }))
    const src = V[operationFactoryKey]({ ctx: { kvStore }, args: [[id]] })
    const pA = applyVertexProperty(src, { kvStore, assertAndLog: okAssert }, 'a', 1)
    const pB = applyVertexProperty(pA, { kvStore, assertAndLog: okAssert }, 'b', 2)
    const out = await Array.fromAsync(pB)
    assert.deepEqual(out, [id])

    const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: id, ctx: { kvStore }, args: ['a', 'b'] }))
    assert.equal(vm.a, 1)
    assert.equal(vm.b, 2)
  })

  test('bulk apply: V(idA,idB).property("flag",true) sets both; yields same ids', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['T'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['T'] }))
    const src = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a, b]] })
    const setFlag = applyVertexProperty(src, { kvStore, assertAndLog: okAssert }, 'flag', true)
    const out = await Array.fromAsync(setFlag)
    assert.deepEqual(out, [a, b])

    for (const id of [a, b]) {
      const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: id, ctx: { kvStore }, args: ['flag'] }))
      assert.equal(vm.flag, true)
    }
  })

  test('overwrite single-cardinality: setting count=1 then 2 leaves final value 2', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['C'] }))
    const src = V[operationFactoryKey]({ ctx: { kvStore }, args: [[id]] })
    await Array.fromAsync(applyVertexProperty(src, { kvStore, assertAndLog: okAssert }, 'count', 1))
    await Array.fromAsync(applyVertexProperty(src, { kvStore, assertAndLog: okAssert }, 'count', 2))

    const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: id, ctx: { kvStore }, args: ['count'] }))
    assert.equal(vm.count, 2)
  })

  test('value types: accept string/number/boolean/object; reject undefined/functions/symbols', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['V'] }))
    const src = V[operationFactoryKey]({ ctx: { kvStore }, args: [[id]] })

    // Acceptable types
    await Array.fromAsync(applyVertexProperty(src, { kvStore, assertAndLog: okAssert }, 's', 'str'))
    await Array.fromAsync(applyVertexProperty(src, { kvStore, assertAndLog: okAssert }, 'n', 42))
    await Array.fromAsync(applyVertexProperty(src, { kvStore, assertAndLog: okAssert }, 'b', false))
    await Array.fromAsync(applyVertexProperty(src, { kvStore, assertAndLog: okAssert }, 'o', { x: 1 }))

    const [vm] = await Array.fromAsync(vertexValueMap[operationFactoryKey]({ parent: id, ctx: { kvStore }, args: ['s', 'n', 'b', 'o'] }))
    assert.equal(vm.s, 'str')
    assert.equal(vm.n, 42)
    assert.equal(vm.b, false)
    assert.deepEqual(vm.o, { x: 1 })

    // Rejected types (JSON.stringify -> undefined => kv.update TypeError)
    const bads = [undefined, () => { }, Symbol('x')]
    for (const bad of bads) {
      const t = applyVertexProperty(src, { kvStore, assertAndLog: okAssert }, 'bad', bad)
      await assert.rejects(() => Array.fromAsync(t))
    }
  })

  test('errors: missing args; one arg only; non-string/empty key; undefined value -> TypeError', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['T'] }))
    const src = V[operationFactoryKey]({ ctx: { kvStore }, args: [[id]] })

    // Missing args (both k and v undefined)
    const t0 = applyVertexProperty(src, { kvStore, assertAndLog: okAssert }, undefined, undefined)
    await assert.rejects(() => Array.fromAsync(t0))

    // One arg only (value undefined)
    const t1 = applyVertexProperty(src, { kvStore, assertAndLog: okAssert }, 'x', undefined)
    await assert.rejects(() => Array.fromAsync(t1))

    // Non-string key (Symbol) -> TypeError when constructing path
    const t2 = applyVertexProperty(src, { kvStore, assertAndLog: typeErrAssert }, Symbol('k'), 'v')
    await assert.rejects(() => Array.fromAsync(t2))

    // Empty key -> expected TypeError by contract
    const t3 = applyVertexProperty(src, { kvStore, assertAndLog: typeErrAssert }, '', 'v')
    await assert.rejects(() => Array.fromAsync(t3))
  })

  test('no-ops: operating on an empty traversal yields empty iterator with no error', async () => {
    const kvStore = await setupKV()
    const src = V[operationFactoryKey]({ ctx: { kvStore }, args: [[]] }) // empty list
    const t = applyVertexProperty(src, { kvStore, assertAndLog: okAssert }, 'x', 1)
    const out = await Array.fromAsync(t)
    assert.deepEqual(out, [])
  })
})

