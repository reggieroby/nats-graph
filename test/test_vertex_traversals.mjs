import assert from 'node:assert'

import { addV } from '../addV.js'
import { addE } from '../addE.js'
import { V } from '../V.js'
import { E } from '../E.js'

// Build small graph: a -(knows)-> b, a -(created)-> c, d -(knows)-> a
const [a] = await Array.fromAsync(await addV('person'));
const [b] = await Array.fromAsync(await addV('person'));
const [c] = await Array.fromAsync(await addV('project'));
const [d] = await Array.fromAsync(await addV('person'));

const ida = a.id();
const idb = b.id();
const idc = c.id();
const idd = d.id();

const [e1] = await Array.fromAsync(await addE('knows', ida, idb));
const [e2] = await Array.fromAsync(await addE('created', ida, idc));
const [e3] = await Array.fromAsync(await addE('knows', idd, ida));

// outE / out from a
{
  const outEids = await (async () => {
    const out = [];
    const [va] = await Array.fromAsync(await V(ida));
    for await (const e of await va.outE()) out.push(e.id());
    return out.sort();
  })();
  assert.deepEqual(outEids.sort(), [e1.id(), e2.id()].sort());

  const outIds = await (async () => {
    const out = [];
    const [va] = await Array.fromAsync(await V(ida));
    for await (const v of await va.out()) out.push(v.id());
    return out.sort();
  })();
  assert.deepEqual(outIds.sort(), [idb, idc].sort());
}

// inE / in to a
{
  const inEids = await (async () => {
    const out = [];
    const [va] = await Array.fromAsync(await V(ida));
    for await (const e of await va.inE('knows')) out.push(e.id());
    return out;
  })();
  assert.deepEqual(inEids, [e3.id()]);

  const inIds = await (async () => {
    const out = [];
    const [va] = await Array.fromAsync(await V(ida));
    for await (const v of await va.in('knows')) out.push(v.id());
    return out;
  })();
  assert.deepEqual(inIds, [idd]);
}

// bothE on a
{
  const be = [];
  const [va] = await Array.fromAsync(await V(ida));
  for await (const e of await va.bothE()) be.push(e.id());
  assert.ok(be.includes(e1.id()));
  assert.ok(be.includes(e2.id()));
  assert.ok(be.includes(e3.id()));
}
