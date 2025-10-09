import assert from 'node:assert/strict'
import test, { suite, after } from 'node:test'

import { addV } from '../../steps/root/addV.js'
import { addE } from '../../steps/root/addE.js'
import { E } from '../../steps/root/E.js'
import { edgeLabel } from '../../steps/terminal/label.js'
import { edgeInV } from '../../steps/shelved/edgeInV.js'
import { edgeOutV } from '../../steps/shelved/edgeOutV.js'
import { operationFactoryKey, Errors } from '../../steps/types.js'
import { kvProvider } from '../../kvProvider/memory/provider.js'
import { diagnostics } from '../../diagnosticsProvider/index.js'

const closers = []
async function setupKV() {
  const kvp = await kvProvider({ ctx: { diagnostics: diagnostics() } })
  closers.push(() => kvp.close?.())
  return kvp.interface
}

const diags = () => diagnostics()

suite('addE() interface', () => {
  after(async () => { for (const c of closers) await c?.() })
  test('returns async-iterable and is lazy', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['B'] }))

    const itr = addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['t', a, b] })
    assert.equal(typeof itr?.[Symbol.asyncIterator], 'function')

    const before = (await Array.fromAsync(E[operationFactoryKey]({ ctx: { kvStore } }))).length
    // No creation until consumed
    assert.equal(before, 0)

    await Array.fromAsync(itr)
    const after = (await Array.fromAsync(E[operationFactoryKey]({ ctx: { kvStore } }))).length
    assert.equal(after, before + 1)
  })

  test('basic creation yields exactly one id present in E()', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['B'] }))

    const out = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['t', a, b] }))
    assert.equal(out.length, 1)
    const id = out[0]
    assert.equal(typeof id, 'string')
    assert.ok(id.length > 0)

    const ids = await Array.fromAsync(E[operationFactoryKey]({ ctx: { kvStore } }))
    assert.ok(ids.includes(id))
  })

  test('label and endpoints reflect provided inputs', async () => {
    const kvStore = await setupKV()
    const [src] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['S'] }))
    const [dst] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['D'] }))
    const [e] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['rel', src, dst] }))

    const [lbl] = await Array.fromAsync(edgeLabel[operationFactoryKey]({ parent: e, ctx: { kvStore } }))
    assert.equal(lbl, 'rel')

    const [toV] = await Array.fromAsync(edgeOutV[operationFactoryKey]({ parent: e, ctx: { kvStore, diagnostics: diags() } }))
    const [fromV] = await Array.fromAsync(edgeInV[operationFactoryKey]({ parent: e, ctx: { kvStore, diagnostics: diags() } }))
    assert.equal(toV, dst)
    assert.equal(fromV, src)
  })

  test('multiple adds produce unique ids; bulk add increases E() count by k', async () => {
    const kvStore = await setupKV()
    // First, two separate edges over distinct endpoint pairs to verify uniqueness
    const [a1] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['X'] }))
    const [b1] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['Y'] }))
    const [a2] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['X'] }))
    const [b2] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['Y'] }))

    const [e1] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['t', a1, b1] }))
    const [e2] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['t', a2, b2] }))
    assert.notEqual(e1, e2)

    const before = (await Array.fromAsync(E[operationFactoryKey]({ ctx: { kvStore } }))).length
    const k = 4
    const created = new Set()
    for (let i = 0; i < k; i++) {
      const [ai] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['S'] }))
      const [bi] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['T'] }))
      const [eid] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['t', ai, bi] }))
      created.add(eid)
    }
    assert.equal(created.size, k)
    const after = (await Array.fromAsync(E[operationFactoryKey]({ ctx: { kvStore } }))).length
    assert.equal(after - before, k)
  })

  test('error handling: invalid/missing args reject', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['P'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['Q'] }))

    // Missing all args
    assert.throws(() => addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: [] }), (err) => err?.code === Errors.EDGE_LABEL_REQUIRED)

    // Missing endpoints
    assert.throws(() => addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['r'] }), (err) => err?.code === Errors.EDGE_INCOMING_REQUIRED)
    assert.throws(() => addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['r', a] }), (err) => err?.code === Errors.EDGE_OUTGOING_REQUIRED)

    // Invalid types and empty strings
    for (const bad of [null, undefined, {}, 123, Symbol('s'), '']) {
      assert.throws(() => addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: [bad, a, b] }), (err) => err?.code === Errors.EDGE_LABEL_REQUIRED)
      assert.throws(() => addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['r', bad, b] }), (err) => err?.code === Errors.EDGE_INCOMING_REQUIRED)
      assert.throws(() => addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['r', a, bad] }), (err) => err?.code === Errors.EDGE_OUTGOING_REQUIRED)
    }
  })

  test('non-existent endpoints must reject', async () => {
    const kvStore = await setupKV()
    const fakeA = 'nonexistent-A'
    const fakeB = 'nonexistent-B'
    await assert.rejects(async () => {
      await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['t', fakeA, fakeB] }))
    }, (err) => err?.code === Errors.EDGE_INCOMING_MISSING)
  })

  test('non-existent outgoing vertex rejects with EDGE_OUTGOING_MISSING', async () => {
    const kvStore = await setupKV()
    const [incoming] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['Present'] }))
    const missingOutgoing = 'missing-outgoing-vertex'
    await assert.rejects(async () => {
      await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['t', incoming, missingOutgoing] }))
    }, (err) => err?.code === Errors.EDGE_OUTGOING_MISSING)
  })
})
