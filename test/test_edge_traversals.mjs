import assert from 'node:assert'

import { addV } from '../addV.js'
import { addE } from '../addE.js'
import { E } from '../E.js'

// Make an edge a->b
const [a] = await Array.fromAsync(await addV('x'));
const [b] = await Array.fromAsync(await addV('y'));
const ida = a.id();
const idb = b.id();
const [e] = await Array.fromAsync(await addE('t', ida, idb));

// outV/inV/bothV/otherV
{
  const [eobj] = await Array.fromAsync(await E(e.id()));
  const [ov] = await Array.fromAsync(await eobj.outV());
  assert.equal(await ov.id(), idb);
  const [iv] = await Array.fromAsync(await eobj.inV());
  assert.equal(await iv.id(), ida);
  const both = await Array.fromAsync(await eobj.bothV());
  const ids = await Promise.all(both.map(v => v.id()));
  assert.ok(ids.includes(ida));
  assert.ok(ids.includes(idb));
  const [otherFromA] = await Array.fromAsync(await eobj.otherV(ida));
  assert.equal(await otherFromA.id(), idb);
  const [otherFromB] = await Array.fromAsync(await eobj.otherV(idb));
  assert.equal(await otherFromB.id(), ida);
}
