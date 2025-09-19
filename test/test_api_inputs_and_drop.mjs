import assert from 'node:assert'

import { addV } from '../addV.js'
import { addE } from '../addE.js'
import { V } from '../V.js'
import { E } from '../E.js'
import { graph } from '../graph.js'

// E() input variants and graph().drop()

// create elements
const [v1] = await Array.fromAsync(await addV('n1'));
const [v2] = await Array.fromAsync(await addV('n2'));
const [e1] = await Array.fromAsync(await addE('t', v1.id(), v2.id()));
const [e2] = await Array.fromAsync(await addE('t', v2.id(), v1.id()));

// E(undefined) iterates all
{
  const ids = [];
  for await (const e of await E()) ids.push(e.id());
  assert.ok(ids.includes(e1.id()));
  assert.ok(ids.includes(e2.id()));
}

// E(array)
{
  const ids = [];
  for await (const e of await E([e1.id(), e2.id()])) ids.push(e.id());
  assert.deepEqual(ids.sort(), [e1.id(), e2.id()].sort());
}

// E(single)
{
  const out = await Array.fromAsync(await E(e1.id()))
  assert.equal(out.length, 1);
  assert.equal(await out[0].id(), e1.id());
}

// root drop clears all
{
  const ok = await graph().drop();
  assert.ok(Array.isArray(ok));
  // verify vertices and edges gone
  const anyV = await Array.fromAsync(await V());
  const anyE = await Array.fromAsync(await E());
  assert.equal(anyV.length, 0);
  assert.equal(anyE.length, 0);
}

