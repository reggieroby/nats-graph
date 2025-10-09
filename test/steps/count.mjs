import assert from 'node:assert/strict'
import test, { suite, after } from 'node:test'

import { V } from '../../steps/root/V.js'
import { E } from '../../steps/root/E.js'
import { addV } from '../../steps/root/addV.js'
import { addE } from '../../steps/root/addE.js'
import { vertexHas } from '../../steps/filter/has.js'
import { vertexLimit, edgeLimit } from '../../steps/filter/limit.js'
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
const typeErrAssert = (v, msg) => { if (!v) throw new TypeError(msg) }

function vertexHasTraversal({ source, ctx, key, expected }) {
  return (async function* () {
    for await (const id of source) {
      const itr = vertexHas[operationFactoryKey]({ parent: id, ctx, args: [key, expected] })
      for await (const match of itr) yield match
    }
  })()
}

suite('count() interface', () => {
  test('type: V().count() returns a number', async () => {
    const kvStore = await setupKV()
    // Seed a couple vertices to ensure non-zero case
    await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['node'] }))
    await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['node'] }))

    const source = V[operationFactoryKey]({ ctx: { kvStore } })
    const wrapped = count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(source)
    assert.equal(typeof wrapped?.[Symbol.asyncIterator], 'function')
    const out = await Array.fromAsync(wrapped)
    assert.equal(out.length, 1)
    assert.equal(typeof out[0], 'number')
  })

  test('empty graph: V().count() -> 0', async () => {
    const kvStore = await setupKV()
    const source = V[operationFactoryKey]({ ctx: { kvStore } })
    const wrapped = count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(source)
    const [n] = await Array.fromAsync(wrapped)
    assert.equal(n, 0)
  })

  test('empty graph: V().has("id","missing").count() -> 0', async () => {
    const kvStore = await setupKV()
    const source = V[operationFactoryKey]({ ctx: { kvStore } })
    const filtered = vertexHasTraversal({ source, ctx: { kvStore, assertAndLog: okAssert }, key: 'id', expected: 'missing' })
    const wrapped = count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(filtered)
    const [n] = await Array.fromAsync(wrapped)
    assert.equal(n, 0)
  })

  test('vertices: after creating N vertices, V().count() -> N', async () => {
    const kvStore = await setupKV()
    const N = 5
    for (let i = 0; i < N; i++) {
      await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['component'] }))
    }
    const source = V[operationFactoryKey]({ ctx: { kvStore } })
    const wrapped = count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(source)
    const [n] = await Array.fromAsync(wrapped)
    assert.equal(n, N)
  })

  test('edges: after creating M edges, E().count() -> M', async () => {
    const kvStore = await setupKV()
    // Seed 2 vertices and M edges between them (self-loop OK here for counting)
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['B'] }))
    const M = 3
    for (let i = 0; i < M; i++) {
      await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: ['linkedTo', a, b] }))
    }
    const source = E[operationFactoryKey]({ ctx: { kvStore } })
    const wrapped = count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(source)
    const [n] = await Array.fromAsync(wrapped)
    assert.equal(n, M)
  })

  test('with filters: V().has("label","component").count() matches subset', async () => {
    const kvStore = await setupKV()
    const lbls = ['component', 'service', 'component', 'service', 'component']
    let expected = 0
    for (const lbl of lbls) {
      await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [lbl] }))
      if (lbl === 'component') expected += 1
    }
    const source = V[operationFactoryKey]({ ctx: { kvStore } })
    const filtered = vertexHasTraversal({ source, ctx: { kvStore, assertAndLog: okAssert }, key: 'label', expected: 'component' })
    const wrapped = count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(filtered)
    const [n] = await Array.fromAsync(wrapped)
    assert.equal(n, expected)
  })

  test('with limit: V(ids).limit(2).count() -> 2 (or total if fewer)', async () => {
    const kvStore = await setupKV()
    const items = ['v1', 'v2', 'v3']
    for (const id of items) await kvStore.create(`node.${id}`, id)
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [items] })
    const limited = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [2] })(source)
    const wrapped = count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(limited)
    const [n] = await Array.fromAsync(wrapped)
    assert.equal(n, 2)

    await kvStore.create('node.x', 'x')
    const shortSource = V[operationFactoryKey]({ ctx: { kvStore }, args: [['x']] })
    const limitedShort = vertexLimit[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert }, args: [2] })(shortSource)
    const [m] = await Array.fromAsync(count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(limitedShort))
    assert.equal(m, 1)
  })

  test('order independence: counts unaffected by input ordering', async () => {
    const kvStore = await setupKV()
    const ids = ['a', 'b', 'c', 'd']
    for (const id of ids) await kvStore.create(`node.${id}`, id)
    const s1 = V[operationFactoryKey]({ ctx: { kvStore }, args: [ids] })
    const s2 = V[operationFactoryKey]({ ctx: { kvStore }, args: [[...ids].reverse()] })
    const [n1] = await Array.fromAsync(count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(s1))
    const [n2] = await Array.fromAsync(count[operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog: okAssert } })(s2))
    assert.equal(n1, ids.length)
    assert.equal(n2, ids.length)
  })

  test.todo('errors: any arguments to count() -> TypeError (current implementation ignores args)')
})
