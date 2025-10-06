import assert from 'node:assert/strict'
import test, { suite } from 'node:test'

import { addV } from '../../steps/root/addV.js'
import { V } from '../../steps/root/V.js'
import { vertexLabel } from '../../steps/terminal/label.js'
import { operationFactoryKey } from '../../steps/types.js'
import { kvProvider } from '../../kvProvider/memory/provider.js'

async function setupKV() {
  const { interface: kvStore } = await kvProvider()
  return kvStore
}

const okAssert = (v, msg) => { if (!v) assert.ok(v, msg) }
const typeErrAssert = (v, msg) => { if (!v) throw new TypeError(msg) }

suite('addV() interface', () => {
  test('returns async-iterable and is lazy', async () => {
    const kvStore = await setupKV()
    const itr = addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['component'] })
    assert.equal(typeof itr?.[Symbol.asyncIterator], 'function')

    const n0 = (await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore } }))).length
    assert.equal(n0, 0)

    // Before consumption, nothing created
    const nBefore = (await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore } }))).length
    assert.equal(nBefore, n0)

    // Consume traversal to perform creation
    await Array.fromAsync(itr)
    const n1 = (await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore } }))).length
    assert.equal(n1, n0 + 1)
  })

  test('basic creation yields exactly one id present in V()', async () => {
    const kvStore = await setupKV()
    const out = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['x'] }))
    assert.equal(out.length, 1)
    const id = out[0]
    assert.equal(typeof id, 'string')
    assert.ok(id.length > 0)

    const ids = await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore } }))
    assert.ok(ids.includes(id))
  })

  test('label semantics: created vertex has provided label', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['component'] }))
    const [lbl] = await Array.fromAsync(vertexLabel[operationFactoryKey]({ parent: id, ctx: { kvStore } }))
    assert.equal(lbl, 'component')
  })

  test('multiple adds produce unique ids; bulk add increases count by k', async () => {
    const kvStore = await setupKV()
    const [id1] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['person'] }))
    const [id2] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['person'] }))
    assert.notEqual(id1, id2)

    const before = (await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore } }))).length
    const k = 5
    const created = new Set()
    for (let i = 0; i < k; i++) {
      const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['x'] }))
      created.add(id)
    }
    assert.equal(created.size, k)
    const after = (await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore } }))).length
    assert.equal(after - before, k)
  })

  test('error handling: invalid label types and missing label throw TypeError', async () => {
    const kvStore = await setupKV()

    // Missing label
    assert.throws(() => addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: typeErrAssert } }), TypeError)

    // Invalid types
    for (const bad of [{}, 123, Symbol('s'), '']) {
      assert.throws(() => addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: typeErrAssert }, args: [bad] }), TypeError)
    }
  })

  test('single consumption creates one vertex; re-reading collected array does not create more', async () => {
    const kvStore = await setupKV()
    const n0 = (await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore } }))).length
    const itr = addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['unit'] })

    const arr = await Array.fromAsync(itr)
    assert.equal(arr.length, 1)
    const n1 = (await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore } }))).length
    assert.equal(n1, n0 + 1)

    // Re-reading the same collected array is a no-op for the graph
    for (const _ of arr) void _
    const n2 = (await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore } }))).length
    assert.equal(n2, n1)
  })
})
