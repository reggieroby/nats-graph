import assert from 'node:assert/strict'
import test, { suite } from 'node:test'

import { V } from '../../steps/root/V.js'
import { E } from '../../steps/root/E.js'
import { addV } from '../../steps/root/addV.js'
import { addE } from '../../steps/root/addE.js'
import { id as idStep } from '../../steps/terminal/id.js'
import { vertexLimit } from '../../steps/filter/limit.js'
import { operationFactoryKey, operationStreamWrapperKey } from '../../steps/types.js'
import { kvProvider } from '../../kvProvider/memory/provider.js'

async function setupKV() {
  const { interface: kvStore } = await kvProvider()
  return kvStore
}

const okAssert = (v, msg) => { if (!v) assert.ok(v, msg) }

// Helper: map a source of vertex IDs to their ids (identity)
function applyVertexId(source, ctx) {
  return (async function* () {
    for await (const vid of source) {
      const itr = idStep[operationFactoryKey]({ parent: vid, ctx, args: [] })
      for await (const out of itr) yield out
    }
  })()
}

// Helper: map a source of edge IDs to their ids (identity)
function applyEdgeId(source, ctx) {
  return (async function* () {
    for await (const eid of source) {
      const itr = idStep[operationFactoryKey]({ parent: eid, ctx, args: [] })
      for await (const out of itr) yield out
    }
  })()
}

suite('id() interface', () => {
  test('type: …id() is async-iterable and yields scalar ids (strings)', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a, b]] })
    const idsTrav = applyVertexId(source, { kvStore, assertAndLog: okAssert })
    assert.equal(typeof idsTrav?.[Symbol.asyncIterator], 'function')

    const out = await Array.fromAsync(idsTrav)
    assert.equal(out.length, 2)
    for (const s of out) assert.equal(typeof s, 'string')
  })

  test("vertices: g.V('a','b','c').id() preserves order and yields ['a','b','c']", async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['X'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['Y'] }))
    const [c] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['Z'] }))

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a, b, c]] })
    const out = await Array.fromAsync(applyVertexId(source, { kvStore, assertAndLog: okAssert }))
    assert.deepEqual(out, [a, b, c])
  })

  test('enumeration: g.V().id() yields the set of existing vertex ids (order-agnostic)', async () => {
    const kvStore = await setupKV()
    const created = []
    for (const lbl of ['A', 'B', 'C', 'A']) {
      const [vid] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [lbl] }))
      created.push(vid)
    }
    const source = V[operationFactoryKey]({ ctx: { kvStore } })
    const out = await Array.fromAsync(applyVertexId(source, { kvStore, assertAndLog: okAssert }))
    assert.equal(out.length, created.length)
    assert.deepEqual(new Set(out), new Set(created))
  })

  test('edges: E(edgeId).id() -> [edgeId] and E().id() includes created ids', async () => {
    const kvStore = await setupKV()
    const [v1] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['V'] }))
    const [v2] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['W'] }))
    const [e1] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['linkedTo', v1, v2] }))
    const [e2] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['uses', v2, v1] }))

    const single = E[operationFactoryKey]({ ctx: { kvStore }, args: [e1] })
    const outSingle = await Array.fromAsync(applyEdgeId(single, { kvStore, assertAndLog: okAssert }))
    assert.deepEqual(outSingle, [e1])

    const allEdges = E[operationFactoryKey]({ ctx: { kvStore } })
    const outAll = await Array.fromAsync(applyEdgeId(allEdges, { kvStore, assertAndLog: okAssert }))
    const produced = new Set(outAll)
    assert.equal(outAll.length, 2)
    assert.ok(produced.has(e1) && produced.has(e2))
  })

  test("chaining: g.V(idA,idB).limit(1).id() -> ['idA']", async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a, b]] })
    const limited = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [1] })(source)
    const out = await Array.fromAsync(applyVertexId(limited, { kvStore, assertAndLog: okAssert }))
    assert.deepEqual(out, [a])
  })

  test('empty: g.V("missing").id() -> []', async () => {
    const kvStore = await setupKV()
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: ['missing'] })
    const out = await Array.fromAsync(applyVertexId(source, { kvStore, assertAndLog: okAssert }))
    assert.deepEqual(out, [])
  })

  // Current implementation ignores args; marking as TODO for future enforcement
  test.todo('errors: any arguments to id() (e.g., id(1)) -> TypeError')
})
