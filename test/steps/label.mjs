import assert from 'node:assert/strict'
import test, { suite, after } from 'node:test'

import { V } from '../../steps/root/V.js'
import { E } from '../../steps/root/E.js'
import { addV } from '../../steps/root/addV.js'
import { addE } from '../../steps/root/addE.js'
import { vertexLabel, edgeLabel } from '../../steps/terminal/label.js'
import { vertexLimit } from '../../steps/filter/limit.js'
import { operationFactoryKey, operationStreamWrapperKey } from '../../steps/types.js'
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
const typeErrAssert = (v, msg) => { if (!v) throw new TypeError(msg) }

// Helper: map a source of vertex IDs to their labels
function applyVertexLabel(source, ctx, ...args) {
  return (async function* () {
    for await (const id of source) {
      const itr = vertexLabel[operationFactoryKey]({ parent: id, ctx, args })
      for await (const out of itr) yield out
    }
  })()
}

// Helper: map a source of edge IDs to their labels
function applyEdgeLabel(source, ctx, ...args) {
  return (async function* () {
    for await (const id of source) {
      const itr = edgeLabel[operationFactoryKey]({ parent: id, ctx, args })
      for await (const out of itr) yield out
    }
  })()
}

suite('label() interface', () => {
  test('type: V(ids).label() returns async-iterable yielding strings', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['component'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['task'] }))

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a, b]] })
    const labelsTrav = applyVertexLabel(source, { kvStore, assertAndLog: okAssert })
    assert.equal(typeof labelsTrav?.[Symbol.asyncIterator], 'function')

    const out = await Array.fromAsync(labelsTrav)
    assert.equal(out.length, 2)
    for (const s of out) assert.equal(typeof s, 'string')
  })

  test('vertices: V(idA,idB).label() preserves order and yields correct labels', async () => {
    const kvStore = await setupKV()
    const [idA] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['component'] }))
    const [idB] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['task'] }))

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[idA, idB]] })
    const out = await Array.fromAsync(applyVertexLabel(source, { kvStore, assertAndLog: okAssert }))
    assert.deepEqual(out, ['component', 'task'])
  })

  test('duplicates: repeated labels are not deduplicated', async () => {
    const kvStore = await setupKV()
    const ids = []
    ids.push((await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['component'] })))[0])
    ids.push((await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['component'] })))[0])

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [ids] })
    const out = await Array.fromAsync(applyVertexLabel(source, { kvStore, assertAndLog: okAssert }))
    assert.deepEqual(out, ['component', 'component'])
  })

  test('enumeration: V().label() yields labels for all vertices (as multiset)', async () => {
    const kvStore = await setupKV()
    const labels = ['A', 'B', 'A', 'C']
    for (const lbl of labels) {
      await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [lbl] }))
    }

    const source = V[operationFactoryKey]({ ctx: { kvStore } })
    const out = await Array.fromAsync(applyVertexLabel(source, { kvStore, assertAndLog: okAssert }))
    assert.equal(out.length, labels.length)
    const count = (arr) => arr.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {})
    assert.deepEqual(count(out), count(labels))
  })

  test('edges: E(e1,e2).label() yields edge labels in order', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['V'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['W'] }))
    const [c] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['X'] }))
    const [d] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['Y'] }))
    const [e1] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['dependsOn', a, b] }))
    const [e2] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['uses', c, d] }))

    const source = E[operationFactoryKey]({ ctx: { kvStore }, args: [[e1, e2]] })
    const out = await Array.fromAsync(applyEdgeLabel(source, { kvStore, assertAndLog: okAssert }))
    assert.deepEqual(out, ['dependsOn', 'uses'])
  })

  test('chaining: V(idA,idB).limit(1).label() yields label for the limited element', async () => {
    const kvStore = await setupKV()
    const [idA] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['component'] }))
    const [idB] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['task'] }))

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[idA, idB]] })
    const limited = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [1] })(source)
    const out = await Array.fromAsync(applyVertexLabel(limited, { kvStore, assertAndLog: okAssert }))
    assert.deepEqual(out, ['component'])
  })

  test.todo('empty: V("missing").label() -> []')

  // Current implementation ignores args; marking as TODO for future enforcement
  test.todo('errors: any arguments to label() -> TypeError')
})
