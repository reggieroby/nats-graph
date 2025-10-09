import assert from 'node:assert/strict'
import test, { suite, after } from 'node:test'

import { V } from '../../steps/root/V.js'
import { E } from '../../steps/root/E.js'
import { addV } from '../../steps/root/addV.js'
import { addE } from '../../steps/root/addE.js'
import { vertexHas, edgeHas } from '../../steps/filter/has.js'
import { vertexPropertyStep } from '../../steps/mutation/property.js'
import { operationFactoryKey, Errors } from '../../steps/types.js'
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

// Helper to compose V(...).has(k,v) as an async-iterable (engine-style)
function vertexHasTraversal({ source, ctx, key, expected }) {
  return (async function* () {
    for await (const id of source) {
      const itr = vertexHas[operationFactoryKey]({ parent: id, ctx, args: [key, expected] })
      for await (const match of itr) yield match
    }
  })()
}

// Helper to compose E(...).has(k,v) as an async-iterable (engine-style)
function edgeHasTraversal({ source, ctx, key, expected }) {
  return (async function* () {
    for await (const id of source) {
      const itr = edgeHas[operationFactoryKey]({ parent: id, ctx, args: [key, expected] })
      for await (const match of itr) yield match
    }
  })()
}

suite('has() interface', () => {
  test('type/laziness: V(...).has(k,v) returns async-iterable; no filtering occurs until consumed', async () => {
    const kvStore = await setupKV()
    const ids = []
    // Seed a few vertices with labels
    for (const lbl of ['component', 'service', 'component']) {
      const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: [lbl] }))
      ids.push(id)
    }

    let getCalls = 0
    const origGet = kvStore.get.bind(kvStore)
    kvStore.get = async (...a) => { getCalls += 1; return origGet(...a) }

    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [ids] })
    const filtered = vertexHasTraversal({ source, ctx: { kvStore, diagnostics: diags() }, key: 'label', expected: 'component' })

    // Not consumed yet -> no kvStore.get calls made by has()
    assert.equal(typeof filtered?.[Symbol.asyncIterator], 'function')
    assert.equal(getCalls, 0)

    const out = await Array.fromAsync(filtered)
    assert.equal(getCalls > 0, true)
    assert.equal(out.length, 2)
  })

  test('label equality: V().has("label","component") yields only vertices with label component', async () => {
    const kvStore = await setupKV()
    const created = { component: [], service: [] }
    for (const lbl of ['component', 'service', 'component', 'service']) {
      const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: [lbl] }))
      created[lbl].push(id)
    }

    const source = V[operationFactoryKey]({ ctx: { kvStore } })
    const filtered = vertexHasTraversal({ source, ctx: { kvStore, diagnostics: diags() }, key: 'label', expected: 'component' })
    const out = await Array.fromAsync(filtered)
    assert.deepEqual(new Set(out), new Set(created.component))
  })

  test('subset order: V(ids).has("label","component") preserves upstream order', async () => {
    const kvStore = await setupKV()
    const ids = []
    const labels = ['service', 'component', 'component']
    for (const lbl of labels) {
      const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: [lbl] }))
      ids.push(id)
    }
    // Reorder upstream arbitrarily
    const ordered = [ids[2], ids[0], ids[1]]
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [ordered] })
    const filtered = vertexHasTraversal({ source, ctx: { kvStore, diagnostics: diags() }, key: 'label', expected: 'component' })
    const out = await Array.fromAsync(filtered)
    // Only the two component-labeled ids, in the provided order
    assert.deepEqual(out, [ids[2], ids[1]])
  })

  test('property equality: after setting name=alpha, V().has("name","alpha") yields those vertices', async () => {
    const kvStore = await setupKV()
    const ids = []
    for (let i = 0; i < 4; i++) {
      const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['node'] }))
      ids.push(id)
    }
    // Set property on two of them
    for (const id of [ids[1], ids[3]]) {
      await Array.fromAsync(vertexPropertyStep[operationFactoryKey]({ parent: id, ctx: { kvStore, diagnostics: diags() }, args: ['name', 'alpha'] }))
    }

    const source = V[operationFactoryKey]({ ctx: { kvStore } })
    const filtered = vertexHasTraversal({ source, ctx: { kvStore, diagnostics: diags() }, key: 'name', expected: 'alpha' })
    const out = await Array.fromAsync(filtered)
    assert.deepEqual(new Set(out), new Set([ids[1], ids[3]]))
  })

  test('works on edges: E().has("label","dependsOn") includes only matching edges', async () => {
    const kvStore = await setupKV()
    // Seed vertices
    const [a] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['A'] }))
    const [b] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['B'] }))
    const [c] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['C'] }))
    // Edges with different labels
    const [e1] = await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['dependsOn', a, b] }))
    await Array.fromAsync(addE[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['linkedTo', b, c] }))

    const source = E[operationFactoryKey]({ ctx: { kvStore } })
    const filtered = edgeHasTraversal({ source, ctx: { kvStore, diagnostics: diags() }, key: 'label', expected: 'dependsOn' })
    const out = await Array.fromAsync(filtered)
    assert.deepEqual(out, [e1])
  })

  test('empty/negative: no matches -> empty iterator', async () => {
    const kvStore = await setupKV()
    // Create only service-labeled vertices
    for (let i = 0; i < 3; i++) {
      await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['service'] }))
    }
    const source = V[operationFactoryKey]({ ctx: { kvStore } })
    const filtered = vertexHasTraversal({ source, ctx: { kvStore, diagnostics: diags() }, key: 'label', expected: 'component' })
    const out = await Array.fromAsync(filtered)
    assert.deepEqual(out, [])
  })

  test('mixed ids: only matching ones, order preserved', async () => {
    const kvStore = await setupKV()
    const ids = []
    const lbls = ['component', 'service', 'component']
    for (const lbl of lbls) {
      const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: [lbl] }))
      ids.push(id)
    }
    const order = [ids[1], ids[2], ids[0]]
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [order] })
    const filtered = vertexHasTraversal({ source, ctx: { kvStore, diagnostics: diags() }, key: 'label', expected: 'component' })
    const out = await Array.fromAsync(filtered)
    assert.deepEqual(out, [ids[2], ids[0]])
  })

  test('errors: missing args -> diagnostics error', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['component'] }))
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[id]] })

    const build = () => vertexHasTraversal({ source, ctx: { kvStore, diagnostics: diags() }, key: undefined, expected: undefined })
    await assert.rejects(() => Array.fromAsync(build()), (err) => err?.code === Errors.HAS_INVALID_KEY)
  })

  test('errors: one arg only -> diagnostics error', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['component'] }))
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[id]] })
    const build = () => vertexHasTraversal({ source, ctx: { kvStore, diagnostics: diags() }, key: 'label', expected: undefined })
    await assert.rejects(() => Array.fromAsync(build()), (err) => err?.code === Errors.HAS_INVALID_VALUE)
  })

  test('errors: non-string key -> diagnostics error', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['component'] }))
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[id]] })
    const buildNum = () => vertexHasTraversal({ source, ctx: { kvStore, diagnostics: diags() }, key: 123, expected: 'x' })
    await assert.rejects(() => Array.fromAsync(buildNum()), (err) => err?.code === Errors.HAS_INVALID_KEY)
    const buildObj = () => vertexHasTraversal({ source, ctx: { kvStore, diagnostics: diags() }, key: {}, expected: 'x' })
    await assert.rejects(() => Array.fromAsync(buildObj()), (err) => err?.code === Errors.HAS_INVALID_KEY)
  })

  test('errors: non-scalar value -> diagnostics error', async () => {
    const kvStore = await setupKV()
    const [id] = await Array.fromAsync(addV[operationFactoryKey]({ ctx: { kvStore, diagnostics: diags() }, args: ['component'] }))
    const source = V[operationFactoryKey]({ ctx: { kvStore }, args: [[id]] })

    const bads = [{}, [], Symbol('s')]
    for (const bad of bads) {
      const build = () => vertexHasTraversal({ source, ctx: { kvStore, diagnostics: diags() }, key: 'label', expected: bad })
      await assert.rejects(() => Array.fromAsync(build()), (err) => err?.code === Errors.HAS_INVALID_VALUE)
    }
  })
})
