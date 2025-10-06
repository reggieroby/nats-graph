import assert from 'node:assert/strict'
import test, { suite } from 'node:test'

import { V } from '../../steps/root/V.js'
import { addV } from '../../steps/root/addV.js'
import { addE } from '../../steps/root/addE.js'
import { out as outStep } from '../../steps/VtoV/out.js'
import { operationFactoryKey } from '../../steps/types.js'
import { kvProvider } from '../../kvProvider/memory/provider.js'

async function setupKV() {
  const { interface: kvStore } = await kvProvider()
  return kvStore
}

const okAssert = (v, msg) => { if (!v) assert.ok(v, msg) }
const typeErrAssert = (v, msg) => { if (!v) throw new TypeError(msg) }

// Helper: map a source of vertex IDs via out(...labels)
function applyOut(source, ctx, ...labels) {
  return (async function* () {
    for await (const vid of source) {
      const itr = outStep[operationFactoryKey]({ parent: vid, ctx, args: labels })
      for await (const nid of itr) yield nid
    }
  })()
}

suite('out() interface', () => {
  test('type/laziness: V(...).out() is async-iterable and does no work until consumed', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['t', a, b] }))

    let keysCalls = 0
    const origKeys = kvStore.keys.bind(kvStore)
    kvStore.keys = async (...args) => { keysCalls += 1; return origKeys(...args) }

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a]] })
    const trav = applyOut(source, { kvStore, assertAndLog: okAssert })
    assert.equal(typeof trav?.[Symbol.asyncIterator], 'function')
    assert.equal(keysCalls, 0)

    const out = await Array.fromAsync(trav)
    assert.deepEqual(new Set(out), new Set([b]))
    assert.ok(keysCalls > 0, 'kvStore.keys should be invoked during iteration')
  })

  test('basic: from vertices with outgoing edges, out() yields adjacent vertex ids', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    const [c] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['C'] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['x', a, b] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['y', a, c] }))

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a]] })
    const out = await Array.fromAsync(applyOut(source, { kvStore, assertAndLog: okAssert }))
    assert.deepEqual(new Set(out), new Set([b, c]))
  })

  test('directionality: only follows outgoing edges', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    // Edge from B -> A only
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['t', b, a] }))

    // From A, no outgoing neighbors
    const outA = await Array.fromAsync(applyOut(V[operationFactoryKey]({ ctx: { kvStore }, args: [[a]] }), { kvStore, assertAndLog: okAssert }))
    assert.deepEqual(outA, [])

    // From B, sees A
    const outB = await Array.fromAsync(applyOut(V[operationFactoryKey]({ ctx: { kvStore }, args: [[b]] }), { kvStore, assertAndLog: okAssert }))
    assert.deepEqual(outB, [a])
  })

  test('label filter: out(label) restricts to that label; multiple labels union', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    const [c] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['C'] }))
    await Promise.all([
      Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['dependsOn', a, b] })),
      Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['uses', a, c] })),
    ])

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a]] })
    const onlyDepends = await Array.fromAsync(applyOut(source, { kvStore, assertAndLog: okAssert }, 'dependsOn'))
    assert.deepEqual(onlyDepends, [b])

    const onlyUses = await Array.fromAsync(applyOut(V[operationFactoryKey]({ ctx: { kvStore }, args: [[a]] }), { kvStore, assertAndLog: okAssert }, 'uses'))
    assert.deepEqual(onlyUses, [c])

    const union = await Array.fromAsync(applyOut(V[operationFactoryKey]({ ctx: { kvStore }, args: [[a]] }), { kvStore, assertAndLog: okAssert }, 'dependsOn', 'uses'))
    assert.deepEqual(new Set(union), new Set([b, c]))
  })

  test('empty cases: vertex with no edges -> []; non-existent start vertex -> []', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))

    const none = await Array.fromAsync(applyOut(V[operationFactoryKey]({ ctx: { kvStore }, args: [[a]] }), { kvStore, assertAndLog: okAssert }))
    assert.deepEqual(none, [])

    // Directly test step behavior with a missing parent (simulating V('missing').out())
    const trav = outStep[operationFactoryKey]({ parent: 'missing', ctx: { kvStore, assertAndLog: okAssert }, args: [] })
    const out = await Array.fromAsync(trav)
    assert.deepEqual(out, [])
  })

  test('multi-source: V(v1,v2).out() yields union of neighbors (order not asserted)', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    const [x] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['X'] }))
    const [y] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['Y'] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['t', a, x] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['t', b, y] }))

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a, b]] })
    const out = await Array.fromAsync(applyOut(source, { kvStore, assertAndLog: okAssert }))
    assert.deepEqual(new Set(out), new Set([x, y]))
  })

  test('chaining: V(v).out().out() reaches neighbors-of-neighbors', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    const [c] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['C'] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['t1', a, b] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['t2', b, c] }))

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a]] })
    const hop1 = applyOut(source, { kvStore, assertAndLog: okAssert })
    const hop2 = applyOut(hop1, { kvStore, assertAndLog: okAssert })
    const out = await Array.fromAsync(hop2)
    assert.deepEqual(out, [c])
  })

  test('multiplicity: duplicates from multi-source are preserved (no implicit dedup across parents)', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    const [z] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['Z'] }))
    // Both A and B point to Z
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['t', a, z] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['t', b, z] }))

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a, b]] })
    const out = await Array.fromAsync(applyOut(source, { kvStore, assertAndLog: okAssert }))
    // Expect Z once per source vertex
    assert.deepEqual(out, [z, z])
  })

  test('invalid label args: empty or non-strings do not throw; empty treated as no filter; others yield []', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['ok', a, b] }))

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a]] })

    // Empty labels are ignored -> behaves like no label filter
    const emptyLike = await Array.fromAsync(applyOut(source, { kvStore, assertAndLog: okAssert }, '', undefined, null))
    assert.deepEqual(emptyLike, [b])

    // Non-string labels are coerced; no matching edges -> [] and no TypeError
    for (const bad of [1, {}, [], Symbol('s')]) {
      const out = await Array.fromAsync(applyOut(source, { kvStore, assertAndLog: okAssert }, bad))
      assert.deepEqual(out, [])
    }
  })
})
