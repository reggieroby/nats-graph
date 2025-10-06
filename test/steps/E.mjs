import assert from 'node:assert/strict'
import test, { suite } from 'node:test'

import { E } from '../../steps/root/E.js'
import { operationFactoryKey } from '../../steps/types.js'
import { kvProvider } from '../../kvProvider/memory/provider.js'

async function setupKV() {
  const { interface: kvStore } = await kvProvider()
  return kvStore
}

suite('E() interface', () => {
  test('E() returns async-iterable and is lazy', async () => {
    const kvStore = await setupKV()
    let keysCalls = 0
    const orig = kvStore.keys.bind(kvStore)
    kvStore.keys = async (pattern) => { keysCalls += 1; return orig(pattern) }

    const itr = E[operationFactoryKey]({ ctx: { kvStore } })
    assert.equal(typeof itr?.[Symbol.asyncIterator], 'function')
    assert.equal(keysCalls, 0, 'kvStore.keys should not be called until iteration')

    const out = await Array.fromAsync(itr)
    assert.deepEqual(out, [])
    assert.equal(keysCalls, 1)
  })

  test('E() enumerates all edges (order-agnostic)', async () => {
    const kvStore = await setupKV()
    const ids = ['e1', 'e2', 'e3']
    for (const id of ids) await kvStore.create(`edges.${id}`, '')
    const out = await Array.fromAsync(E[operationFactoryKey]({ ctx: { kvStore } }))
    assert.deepEqual(new Set(out), new Set(ids))
  })

  test('E(id) yields that id (only if present)', async () => {
    const kvStore = await setupKV()
    await kvStore.create('edges.e1', '')
    const out = await Array.fromAsync(E[operationFactoryKey]({ ctx: { kvStore }, args: ['e1'] }))
    assert.deepEqual(out, ['e1'])

    const outMissing = await Array.fromAsync(E[operationFactoryKey]({ ctx: { kvStore }, args: ['missing-id'] }))
    assert.deepEqual(outMissing, [])
  })


  test('E([ids]) yields existing ids in provided order', async () => {
    const kvStore = await setupKV()
    for (const id of ['e1', 'e2']) await kvStore.create(`edges.${id}`, '')
    const out = await Array.fromAsync(E[operationFactoryKey]({ ctx: { kvStore }, args: [['e1', 'e2', 'e1']] }))
    assert.deepEqual(out, ['e1', 'e2', 'e1'])
  })

  test('E() on empty graph yields []', async () => {
    const kvStore = await setupKV()
    const out = await Array.fromAsync(E[operationFactoryKey]({ ctx: { kvStore } }))
    assert.deepEqual(out, [])
  })
})
