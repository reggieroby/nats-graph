import assert from 'node:assert'

import { addV } from '../addV.js'
import { addE } from '../addE.js'
import { V } from '../V.js'
import { E } from '../E.js'
import { bucket } from '../bucket.js'

// Vertex has('label', ...), has(prop,...)
{
  const [p] = await Array.fromAsync(await addV('person'));
  const pid = p.id();
  const [pv] = await Array.fromAsync(await V(pid));
  await pv.property('name', 'marko');

  // label
  {
    const [pv2] = await Array.fromAsync(await V(pid));
    const out = await Array.fromAsync(await pv2.has('label','person'));
    assert.equal(out.length, 1);
    assert.equal(await out[0].id(), pid);
  }
  // property
  {
    const [pv3] = await Array.fromAsync(await V(pid));
    const out = await Array.fromAsync(await pv3.has('name','marko'));
    assert.equal(out.length, 1);
    assert.equal(await out[0].id(), pid);
  }
}

// Edge has() and endpoint storage consistency
{
  const [a] = await Array.fromAsync(await addV('a'));
  const [b] = await Array.fromAsync(await addV('b'));
  const [e] = await Array.fromAsync(await addE('knows', a.id(), b.id()));
  const [eobj] = await Array.fromAsync(await E(e.id()));
  await eobj.property('weight', 0.5);

  // label
  {
    const [e1] = await Array.fromAsync(await E(e.id()));
    const out = await Array.fromAsync(await e1.has('label','knows'));
    assert.equal(out.length, 1);
    assert.equal(await out[0].id(), e.id());
  }
  // property
  {
    const [e2] = await Array.fromAsync(await E(e.id()));
    const out = await Array.fromAsync(await e2.has('weight', 0.5));
    assert.equal(out.length, 1);
  }

  // endpoint keys exist (incoming/outgoing)
  const bkt = await bucket();
  const incoming = await bkt.get(`edge.${e.id()}.incoming`).then(d => d.string());
  const outgoing = await bkt.get(`edge.${e.id()}.outgoing`).then(d => d.string());
  assert.equal(incoming, a.id());
  assert.equal(outgoing, b.id());
}
