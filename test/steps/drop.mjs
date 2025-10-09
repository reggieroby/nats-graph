import assert from 'node:assert/strict'
import test, { suite, after } from 'node:test'

import { V } from '../../steps/root/V.js'
import { E } from '../../steps/root/E.js'
import { addV } from '../../steps/root/addV.js'
import { addE } from '../../steps/root/addE.js'
import { dropVertex, dropEdge } from '../../steps/terminal/drop.js'
import { count } from '../../steps/terminal/count.js'
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

async function countVertices(kvStore) {
  const source = V[operationFactoryKey]({ ctx: { kvStore } })
  const [n] = await Array.fromAsync(count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(source))
  return n
}

async function countEdges(kvStore) {
  const source = E[operationFactoryKey]({ ctx: { kvStore } })
  const [n] = await Array.fromAsync(count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(source))
  return n
}

function dropVerticesTraversal({ source, ctx }) {
  return (async function* () {
    for await (const id of source) {
      const itr = dropVertex[operationFactoryKey]({ parent: id, ctx })
      for await (const _ of itr) {
        // drop yields nothing
      }
    }
  })()
}

function dropEdgesTraversal({ source, ctx }) {
  return (async function* () {
    for await (const id of source) {
      const itr = dropEdge[operationFactoryKey]({ parent: id, ctx })
      for await (const _ of itr) {
        // drop yields nothing
      }
    }
  })()
}

suite('drop() interface', () => {
  test('type/laziness: drop() is async-iterable, yields no items, side-effects on consumption', async () => {
    const kvStore = await setupKV()
    // Seed a vertex and an edge so a delete will happen when consumed
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['linkedTo', a, b] }))

    let deletes = 0
    const origDel = kvStore.delete.bind(kvStore)
    kvStore.delete = async (...a) => { deletes += 1; return origDel(...a) }

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[a]] })
    const dropItr = dropVerticesTraversal({ source, ctx: { kvStore } })

    // No side effects before consumption
    assert.equal(typeof dropItr?.[Symbol.asyncIterator], 'function')
    assert.equal(deletes, 0)

    const out = await Array.fromAsync(dropItr)
    assert.equal(out.length, 0)
    assert.ok(deletes > 0)
  })

  test.skip('vertex drop: removing a vertex eliminates its incident edges; counts reflect deletion', async () => {
    const kvStore = await setupKV()
    // Create three vertices and two edges a->b and b->c
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    const [c] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['C'] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['x', a, b] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['y', b, c] }))

    const beforeV = await countVertices(kvStore)
    // Incident edge counts before drop
    const beforeInToB = await Array.fromAsync(
      count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(
        (async () => {
          const src = E[operationFactoryKey]({ ctx: { kvStore } })
          // Filter to edges with incoming === b
          const itr = (async function* () {
            for await (const eid of src) {
              const incoming = await kvStore.get(`edge.${eid}.incoming`).then(d => d?.string()).catch(() => null)
              if (incoming === b) yield eid
            }
          })()
          return itr
        })()
      )
    ).then(([n]) => n)
    const beforeOutFromB = await Array.fromAsync(
      count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(
        (async () => {
          const src = E[operationFactoryKey]({ ctx: { kvStore } })
          const itr = (async function* () {
            for await (const eid of src) {
              const outgoing = await kvStore.get(`edge.${eid}.outgoing`).then(d => d?.string()).catch(() => null)
              if (outgoing === b) yield eid
            }
          })()
          return itr
        })()
      )
    ).then(([n]) => n)

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[b]] })
    await Array.fromAsync(dropVerticesTraversal({ source, ctx: { kvStore } }))

    const afterV = await countVertices(kvStore)
    const afterInToB = await Array.fromAsync(
      count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(
        (async () => {
          const src = E[operationFactoryKey]({ ctx: { kvStore } })
          const itr = (async function* () {
            for await (const eid of src) {
              const incoming = await kvStore.get(`edge.${eid}.incoming`).then(d => d?.string()).catch(() => null)
              if (incoming === b) yield eid
            }
          })()
          return itr
        })()
      )
    ).then(([n]) => n)
    const afterOutFromB = await Array.fromAsync(
      count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(
        (async () => {
          const src = E[operationFactoryKey]({ ctx: { kvStore } })
          const itr = (async function* () {
            for await (const eid of src) {
              const outgoing = await kvStore.get(`edge.${eid}.outgoing`).then(d => d?.string()).catch(() => null)
              if (outgoing === b) yield eid
            }
          })()
          return itr
        })()
      )
    ).then(([n]) => n)

    assert.equal(afterV, beforeV - 1)
    assert.equal(beforeInToB, 1)
    assert.equal(beforeOutFromB, 1)
    assert.equal(afterInToB, 0)
    assert.equal(afterOutFromB, 0)
  })

  test.skip('edge drop: removes only the targeted edge; vertices remain', async () => {
    const kvStore = await setupKV()
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    const [e1] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['l1', a, b] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['l2', a, b] }))

    const beforeV = await countVertices(kvStore)
    const beforeE = await countEdges(kvStore)

    const source = E[operationFactoryKey]({ ctx: { kvStore }, args: [[e1]] })
    await Array.fromAsync(dropEdgesTraversal({ source, ctx: { kvStore } }))

    const afterV = await countVertices(kvStore)
    const afterE = await countEdges(kvStore)

    assert.equal(afterV, beforeV)
    assert.equal(afterE, beforeE - 1)
  })

  test('idempotency: dropping empty/nonexistent selections is a no-op', async () => {
    const kvStore = await setupKV()
    // Seed some data
    await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['X'] }))
    await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['Y'] }))
    const beforeV = await countVertices(kvStore)
    const beforeE = await countEdges(kvStore)

    // Drop on empty selection
    const empty = V[operationFactoryKey]({ ctx: { kvStore }, args: [[]] })
    await Array.fromAsync(dropVerticesTraversal({ source: empty, ctx: { kvStore } }))

    // Drop on nonexistent ids
    const missing = V[operationFactoryKey]({ ctx: { kvStore }, args: [['missing-1', 'missing-2']] })
    await Array.fromAsync(dropVerticesTraversal({ source: missing, ctx: { kvStore } }))

    const afterV = await countVertices(kvStore)
    const afterE = await countEdges(kvStore)
    assert.equal(afterV, beforeV)
    assert.equal(afterE, beforeE)
  })

  test.todo('errors: any arguments to drop() -> TypeError (current implementation ignores args)')
})
