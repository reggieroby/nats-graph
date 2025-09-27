import assert from 'node:assert'

import { bucket } from '../bucket.js'
import { addV } from '../addV.js'
import { V } from '../V.js'

// create a session vertex and validate label
{
  const it = await addV('session');
  const arr = await Array.fromAsync(it);
  assert.equal(arr.length, 1);
  const v = arr[0];
  assert.equal(await v.label(), 'session');
  assert.ok(await v.id());
}

// V(single id) yields one
{
  const id = 'vertex-abc';
  const b = await bucket();
  await b.create(`node.${id}`, "");
  await b.create(`node.${id}.label`, 'custom');
  const it = await V(id);
  const arr = await Array.fromAsync(it);
  assert.equal(arr.length, 1);
  assert.equal(await arr[0].label(), 'custom');
}

