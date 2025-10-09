import assert from 'node:assert/strict'
import test, { suite, after } from 'node:test'

import { V } from '../../steps/root/V.js'
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

suite('V() interface', () => {
  test('V() returns async-iterable and is lazy', async () => {
    const kvStore = await setupKV()
    let keysCalls = 0
    const origKeys = kvStore.keys.bind(kvStore)
    kvStore.keys = async (pattern) => { keysCalls += 1; return origKeys(pattern) }

    const itr = V[operationFactoryKey]({ ctx: { kvStore } })
    assert.equal(typeof itr?.[Symbol.asyncIterator], 'function')
    assert.equal(keysCalls, 0, 'kvStore.keys should not be called until iteration')

    const out = await Array.fromAsync(itr)
    assert.deepEqual(out, [])
    assert.equal(keysCalls, 1)
  })

  test('V() enumerates all vertices (order-agnostic)', async () => {
    const kvStore = await setupKV()
    const ids = ['A', 'B', 'C']
    for (const id of ids) await kvStore.create(`node.${id}`, '')
    const out = await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore } }))
    assert.deepEqual(new Set(out), new Set(ids))
  })

  test('V(id) yields that id (only if present)', async () => {
    const kvStore = await setupKV()
    await kvStore.create('node.A', 'A')
    const out = await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore }, args: ['A'] }))
    assert.deepEqual(out, ['A'])

    const outMissing = await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore }, args: ['missing'] }))
    assert.deepEqual(outMissing, [])
  })

  test('V([ids]) yields existing ids in provided order', async () => {
    const kvStore = await setupKV()
    const ids = [1, '2', 3, '2']
    // Create all unique ids to match expectation
    for (const id of new Set(ids.map(String))) await kvStore.create(`node.${id}`, String(id))
    const out = await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore }, args: [ids] }))
    assert.deepEqual(out.map(String), ['1', '2', '3', '2'])
  })

  test('V() on empty graph yields []', async () => {
    const kvStore = await setupKV()
    const out = await Array.fromAsync(V[operationFactoryKey]({ ctx: { kvStore } }))
    assert.deepEqual(out, [])
  })
})
