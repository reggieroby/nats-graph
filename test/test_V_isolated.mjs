import assert from 'node:assert'

import { addV } from '../addV.js'
import { addE } from '../addE.js'
import { V } from '../V.js'
import { graph } from '../graph.js'


// Reset
await graph().drop()

// id(), label()
{
  const [v] = await Array.fromAsync(await addV('person'))
  const id = v.id()
  const [vv] = await Array.fromAsync(await V(id))
  assert.equal(await vv.id(), id)
  assert.equal(await vv.label(), 'person')
}

// property(), properties(), valueMap()
{
  const [v] = await Array.fromAsync(await addV('x'))
  const id = v.id()
  const [vv] = await Array.fromAsync(await V(id))
  await vv.property('a', 1)
  await vv.property('b', { z: true })
  assert.equal(await vv.properties('a'), 1)
  const map = await vv.valueMap()
  assert.equal(map.a, 1)
  assert.deepEqual(map.b, { z: true })
}

// has(label), has(prop)
{
  const [v] = await Array.fromAsync(await addV('foo'))
  const id = v.id()
  const [vv] = await Array.fromAsync(await V(id))
  await vv.property('p', 'q')
  assert.equal((await Array.fromAsync(await vv.has('label', 'foo'))).length, 1)
  assert.equal((await Array.fromAsync(await vv.has('p', 'q'))).length, 1)
}

// outE(), out(), inE(), in(), bothE()
{
  const [a] = await Array.fromAsync(await addV('A'))
  const [b] = await Array.fromAsync(await addV('B'))
  const [c] = await Array.fromAsync(await addV('C'))
  const [e1] = await Array.fromAsync(await addE('t1', a.id(), b.id()))
  const [e2] = await Array.fromAsync(await addE('t2', c.id(), a.id()))
  const [va] = await Array.fromAsync(await V(a.id()))
  const outE = await Array.fromAsync(await va.outE())
  assert.deepEqual(outE.map(e => e.id()).sort(), [e1.id()].sort())
  const outV = await Array.fromAsync(await va.out())
  assert.deepEqual(outV.map(v => v.id()).sort(), [b.id()].sort())
  const inE = await Array.fromAsync(await va.inE())
  assert.deepEqual(inE.map(e => e.id()).sort(), [e2.id()].sort())
  const inV = await Array.fromAsync(await va.in())
  assert.deepEqual(inV.map(v => v.id()).sort(), [c.id()].sort())
  const bothE = await Array.fromAsync(await va.bothE())
  const beIds = bothE.map(e => e.id())
  assert.ok(beIds.includes(e1.id()) && beIds.includes(e2.id()))
}

// drop() removes vertex and incident edges
{
  const [x] = await Array.fromAsync(await addV('X'))
  const [y] = await Array.fromAsync(await addV('Y'))
  const [e] = await Array.fromAsync(await addE('t', x.id(), y.id()))
  const [vx] = await Array.fromAsync(await V(x.id()))
  await vx.drop()
  const allV = await Array.fromAsync(await V())
  const ids = new Set(await Promise.all(allV.map(v => v.id())))
  assert.ok(!ids.has(x.id()))
}

