import assert from 'node:assert/strict'
import test, { suite } from 'node:test'

import { V } from '../../steps/root/V.js'
import { E } from '../../steps/root/E.js'
import { vertexLimit, edgeLimit } from '../../steps/filter/limit.js'
import { operationFactoryKey, operationStreamWrapperKey } from '../../steps/types.js'
import { kvProvider } from '../../kvProvider/memory/provider.js'

async function setupKV() {
  const { interface: kvStore } = await kvProvider()
  return kvStore
}

const okAssert = (v, msg) => { if (!v) assert.ok(v, msg) }
const typeErrAssert = (v, msg) => { if (!v) throw new TypeError(msg) }

suite('limit() interface', () => {
  test('type: V(...).limit(n) returns an async-iterable traversal', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b', 'c']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b', 'c']] })
    const limited = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [2] })(source)
    assert.equal(typeof limited?.[Symbol.asyncIterator], 'function')
  })

  test('basic: V(a,b,c).limit(2) yields [a,b]', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b', 'c']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b', 'c']] })
    const limited = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [2] })(source)
    const got = await Array.fromAsync(limited)
    assert.deepEqual(got, ['a', 'b'])
  })

  test('zero: limit(0) yields []', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b', 'c']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b', 'c']] })
    const limited = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [0] })(source)
    const got = await Array.fromAsync(limited)
    assert.deepEqual(got, [])
  })

  test('over-limit: limit(10) yields all available items', async () => {
    const kvStore = await setupKV()
    const items = ['x', 'y']
    for (const id of items) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [items] })
    const limited = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [10] })(source)
    const got = await Array.fromAsync(limited)
    assert.deepEqual(got, items)
  })

  test('chaining: limit(5).limit(2) yields 2 items', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b', 'c', 'd', 'e']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b', 'c', 'd', 'e']] })
    const l5 = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [5] })(source)
    const l2 = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [2] })(l5)
    const got = await Array.fromAsync(l2)
    assert.deepEqual(got, ['a', 'b'])
  })

  test('works on edges: E(...).limit(1) yields first id', async () => {
    const kvStore = await setupKV()
    const edgeIds = ['e1', 'e2']
    for (const id of edgeIds) await kvStore.create(`edges.${id}`, '')
    const source = E[operationFactoryKey]({ ctx: { kvStore }, args: [edgeIds] })
    const limited = edgeLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [1] })(source)
    const got = await Array.fromAsync(limited)
    assert.deepEqual(got, ['e1'])
  })

  test('errors: missing arg -> TypeError', async () => {
    const kvStore = await setupKV()
    assert.throws(() => vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: typeErrAssert } }), TypeError)
  })

  test('errors: non-number -> TypeError', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b']] })
    for (const bad of [null, '2']) {
      assert.throws(() => vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: typeErrAssert }, args: [bad] })(source), TypeError)
    }
  })

  test('errors: NaN/Infinity -> TypeError', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b']] })
    for (const bad of [NaN, Infinity]) {
      assert.throws(() => vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: typeErrAssert }, args: [bad] })(source), TypeError)
    }
  })

  test('errors: negative -> TypeError', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b']] })
    assert.throws(() => vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: typeErrAssert }, args: [-1] })(source), TypeError)
  })

  test('errors: non-integer -> TypeError', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b']] })
    assert.throws(() => vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: typeErrAssert }, args: [1.5] })(source), TypeError)
  })

  test('ordering: preserves upstream order with explicit IDs', async () => {
    const kvStore = await setupKV()
    const items = ['v1', 'v2', 'v3', 'v4']
    for (const id of items) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [items] })
    const limited = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [3] })(source)
    const got = await Array.fromAsync(limited)
    assert.deepEqual(got, ['v1', 'v2', 'v3'])
  })
})
