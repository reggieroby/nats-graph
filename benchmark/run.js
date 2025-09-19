#!/usr/bin/env node
// Basic micro-benchmarks for the graph API using tinybench.
// Usage:
//   npm i -D tinybench
//   node main/bootstrap/components/fullflowService/nats/graph/benchmark/run.js

import path from 'node:path'
import url from 'node:url'
import { Bench } from 'tinybench'
import { connection } from '../natsConnection.js'


async function main() {

  await connection.client("10.88.0.93")
  await connection.Kvm()
  // Import graph API
  const base = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)))
  const { addV } = await import(url.pathToFileURL(path.join(base, 'addV.js')))
  const { addE } = await import(url.pathToFileURL(path.join(base, 'addE.js')))
  const { V } = await import(url.pathToFileURL(path.join(base, 'V.js')))
  const { E } = await import(url.pathToFileURL(path.join(base, 'E.js')))
  const { graph } = await import(url.pathToFileURL(path.join(base, 'graph.js')))

  // Warm up: ensure module init costs don't skew short benches
  await graph().drop()

  const bench = new Bench({ time: 500, warmup: 100 })

  const items = []
  for (let i = 0; i < 2000; i++) { items.push(i) }
  // Task: addV (create)
  bench.add('addV', async () => {
    const vItrArray = await Promise.all(items.map(() => addV('bench_v')))
    const vItrResult = await Promise.all(vItrArray.map(i => Array.fromAsync(i)))
  })
  // Prepare two vertices for edge tasks
  const [v1] = await Array.fromAsync(await addV('bench_src'))
  const [v2] = await Array.fromAsync(await addV('bench_dst'))

  // bench.add('addE', async () => Array.fromAsync(await addE(`bench_e`, v1.id(), v2.id())))

  // // Task: addV + drop (create and immediately delete a vertex)
  // bench.add('addV + drop', async () => {
  //   const [v] = await Array.fromAsync(await addV('bench_v'))
  //   await v.drop()
  // })


  // // Task: addE + drop (create and immediately delete an edge)
  // bench.add('addE + drop', async () => {
  //   const [e] = await Array.fromAsync(await addE('bench_e', v1.id(), v2.id()))
  //   await e.drop()
  // })

  // // Prepare a small star for traversal tasks
  // const [center] = await Array.fromAsync(await addV('center'))
  // const [cv] = await Array.fromAsync(await V(center.id()))
  // const neighbors = []
  // for (let i = 0; i < 5; i++) {
  //   const [nv] = await Array.fromAsync(await addV('n'))
  //   neighbors.push(nv)
  //   await Array.fromAsync(await addE('link', center.id(), nv.id()))
  // }

  // // Task: V(center).outE().id()
  // bench.add('V.outE().id()', async () => {
  //   const ids = []
  //   for await (const e of await cv.outE()) ids.push(e.id())
  // })

  // // Task: V(center).out().id()
  // bench.add('V.out().id()', async () => {
  //   const ids = []
  //   for await (const v of await cv.out()) ids.push(v.id())
  // })

  // // Prepare a single edge for edge->vertex tasks
  // const [edge1] = await Array.fromAsync(await addE('one', v1.id(), v2.id()))

  // bench.add('E.outV().id()', async () => {
  //   const [e] = await Array.fromAsync(await E(edge1.id()))
  //   const [ov] = await Array.fromAsync(await e.outV())
  //   ov.id()
  // })

  // bench.add('E.inV().id()', async () => {
  //   const [e] = await Array.fromAsync(await E(edge1.id()))
  //   const [iv] = await Array.fromAsync(await e.inV())
  //   iv.id()
  // })

  // // Property set + has
  // bench.add('V.property + has()', async () => {
  //   const [v] = await Array.fromAsync(await addV('p'))
  //   await v.property('x', 1)
  //   const out = await Array.fromAsync(await v.has('x', 1))
  //   if (out.length !== 1) throw new Error('has failed')
  //   await v.drop()
  // })

  // // edgeEndpoints on a batch
  // const batchEdges = []
  // for (let i = 0; i < 10; i++) {
  //   const [sx] = await Array.fromAsync(await addV('s'))
  //   const [tx] = await Array.fromAsync(await addV('t'))
  //   const [ex] = await Array.fromAsync(await addE('b', sx.id(), tx.id()))
  //   batchEdges.push(ex.id())
  // }

  // {


  //   const [a] = await Array.fromAsync(await addV('A'))
  //   const [b] = await Array.fromAsync(await addV('B'))
  //   const [eCreated] = await Array.fromAsync(await addE('t', a.id(), b.id()))
  //   const [eobj] = await Array.fromAsync(await E(eCreated.id()))
  //   await eobj.property('w', 1)


  //   bench.add('E.id()', async () => { await eobj.id() })
  //   bench.add('E.label()', async () => { await eobj.label() })
  //   bench.add('E.properties()', async () => { await eobj.properties('w') })
  //   bench.add('E.valueMap()', async () => { await eobj.valueMap() })
  //   bench.add('E.has(label)', async () => { await Array.fromAsync(await eobj.has('label', 't')) })
  //   bench.add('E.has(prop)', async () => { await Array.fromAsync(await eobj.has('w', 1)) })
  //   bench.add('E.property()', async () => { await eobj.property('w2', 2) })
  //   bench.add('E.outV()', async () => { for await (const _v of await eobj.outV()) { } })
  //   bench.add('E.inV()', async () => { for await (const _v of await eobj.inV()) { } })
  //   bench.add('E.bothV()', async () => { for await (const _v of await eobj.bothV()) { } })
  //   bench.add('E.otherV()', async () => { for await (const _v of await eobj.otherV(a.id())) { } })
  //   bench.add('E.drop()', async () => {
  //     const [x] = await Array.fromAsync(await addV('x'));
  //     const [y] = await Array.fromAsync(await addV('y'));
  //     const [ee] = await Array.fromAsync(await addE('d', x.id(), y.id()));
  //     const [eo] = await Array.fromAsync(await E(ee.id())); await eo.drop()
  //   })
  // }


  // {

  //   const [a] = await Array.fromAsync(await addV('person'))
  //   const [b] = await Array.fromAsync(await addV('person'))
  //   const [c] = await Array.fromAsync(await addV('project'))
  //   const [d] = await Array.fromAsync(await addV('person'))
  //   await Array.fromAsync(await addE('knows', a.id(), b.id()))
  //   await Array.fromAsync(await addE('created', a.id(), c.id()))
  //   await Array.fromAsync(await addE('knows', d.id(), a.id()))
  //   const [va] = await Array.fromAsync(await V(a.id()))
  //   await va.property('name', 'alpha')
  //   await va.property('score', 42)

  //   bench.add('V.id()', async () => { await va.id() })
  //   bench.add('V.label()', async () => { await va.label() })
  //   bench.add('V.properties("name")', async () => { await va.properties('name') })
  //   bench.add('V.valueMap()', async () => { await va.valueMap() })
  //   bench.add('V.has(label)', async () => { await Array.fromAsync(await va.has('label', 'person')) })
  //   bench.add('V.has(prop)', async () => { await Array.fromAsync(await va.has('name', 'alpha')) })
  //   bench.add('V.property()', async () => { await va.property('bench', 1) })
  //   bench.add('V.outE()', async () => { for await (const _e of await va.outE()) { } })
  //   bench.add('V.out()', async () => { for await (const _v of await va.out()) { } })
  //   bench.add('V.inE()', async () => { for await (const _e of await va.inE()) { } })
  //   bench.add('V.in()', async () => { for await (const _v of await va.in()) { } })
  //   bench.add('V.bothE()', async () => { for await (const _e of await va.bothE()) { } })
  //   bench.add('V.drop()', async () => { const [vx] = await Array.fromAsync(await addV('tmp')); await vx.drop() })


  // }


  // Run benchmarks
  await bench.run()

  // Pretty print results
  const rows = bench.tasks.map(({ name, result: r }) => ({
    task: name,
    'ops/s': Number(r.hz.toFixed(2)),
    'avg (ms)': Number(r.mean * 1000).toFixed(3),
    '±%': Number(r.rme.toFixed(2)),
    'p99': r.p99.toFixed(2),
    samples: r.samples.length,
  }))
  console.table(rows)
}

main().catch((e) => { console.error(e); process.exit(1) })
