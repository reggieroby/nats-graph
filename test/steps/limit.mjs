import assert from 'node:assert/strict'
import test, { suite, after } from 'node:test'

import { V } from '../../steps/root/V.js'
import { E } from '../../steps/root/E.js'
import { vertexLimit, edgeLimit } from '../../steps/filter/limit.js'
import { operationFactoryKey, operationStreamWrapperKey, Errors } from '../../steps/types.js'
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

suite('limit() interface', () => {
  test('type: V(...).limit(n) returns an async-iterable traversal', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b', 'c']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b', 'c']] })
    const limited = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, diagnostics: diags() }, args: [2] })(source)
    assert.equal(typeof limited?.[Symbol.asyncIterator], 'function')
  })

  test('basic: V(a,b,c).limit(2) yields [a,b]', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b', 'c']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b', 'c']] })
    const limited = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, diagnostics: diags() }, args: [2] })(source)
    const got = await Array.fromAsync(limited)
    assert.deepEqual(got, ['a', 'b'])
  })

  test('zero: limit(0) yields []', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b', 'c']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b', 'c']] })
    const limited = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, diagnostics: diags() }, args: [0] })(source)
    const got = await Array.fromAsync(limited)
    assert.deepEqual(got, [])
  })

  test('over-limit: limit(10) yields all available items', async () => {
    const kvStore = await setupKV()
    const items = ['x', 'y']
    for (const id of items) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [items] })
    const limited = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, diagnostics: diags() }, args: [10] })(source)
    const got = await Array.fromAsync(limited)
    assert.deepEqual(got, items)
  })

  test('chaining: limit(5).limit(2) yields 2 items', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b', 'c', 'd', 'e']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b', 'c', 'd', 'e']] })
    const l5 = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, diagnostics: diags() }, args: [5] })(source)
    const l2 = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, diagnostics: diags() }, args: [2] })(l5)
    const got = await Array.fromAsync(l2)
    assert.deepEqual(got, ['a', 'b'])
  })

  test('works on edges: E(...).limit(1) yields first id', async () => {
    const kvStore = await setupKV()
    const edgeIds = ['e1', 'e2']
    for (const id of edgeIds) await kvStore.create(`edges.${id}`, '')
    const source = E[operationFactoryKey]({ ctx: { kvStore }, args: [edgeIds] })
    const limited = edgeLimit[operationStreamWrapperKey]({ ctx: { kvStore, diagnostics: diags() }, args: [1] })(source)
    const got = await Array.fromAsync(limited)
    assert.deepEqual(got, ['e1'])
  })

  test('errors: missing arg -> diagnostics error', async () => {
    const kvStore = await setupKV()
    assert.throws(() => vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, diagnostics: diags() } }), (err) => err?.code === Errors.LIMIT_INVALID && err?.type === 'Precondition')
  })

  test('errors: non-number -> diagnostics error', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b']] })
    for (const bad of [null, '2']) {
      assert.throws(() => vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, diagnostics: diags() }, args: [bad] })(source), (err) => err?.code === Errors.LIMIT_INVALID)
    }
  })

  test('errors: NaN/Infinity -> diagnostics error', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b']] })
    for (const bad of [NaN, Infinity]) {
      assert.throws(() => vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, diagnostics: diags() }, args: [bad] })(source), (err) => err?.code === Errors.LIMIT_INVALID)
    }
  })

  test('errors: negative -> diagnostics error', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b']] })
    assert.throws(() => vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, diagnostics: diags() }, args: [-1] })(source), (err) => err?.code === Errors.LIMIT_INVALID)
  })

  test('errors: non-integer -> diagnostics error', async () => {
    const kvStore = await setupKV()
    for (const id of ['a', 'b']) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [['a', 'b']] })
    assert.throws(() => vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, diagnostics: diags() }, args: [1.5] })(source), (err) => err?.code === Errors.LIMIT_INVALID)
  })

  test('ordering: preserves upstream order with explicit IDs', async () => {
    const kvStore = await setupKV()
    const items = ['v1', 'v2', 'v3', 'v4']
    for (const id of items) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [items] })
    const limited = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, diagnostics: diags() }, args: [3] })(source)
    const got = await Array.fromAsync(limited)
    assert.deepEqual(got, ['v1', 'v2', 'v3'])
  })
})
