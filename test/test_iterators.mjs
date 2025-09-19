import assert from 'node:assert'

import { bucket } from '../bucket.js'
import { V } from '../V.js'

// Prepare some nodes
const b = await bucket();
await b.create(`node.alpha`, "");
await b.create(`node.alpha.label`, 'a');
await b.create(`node.beta`, "");
await b.create(`node.beta.label`, 'b');

// V(undefined) iterates all
{
  const it = await V();
  const ids = [];
  for await (const v of it) ids.push(v.id());
  assert.ok(ids.includes('alpha'));
  assert.ok(ids.includes('beta'));
}

// V(array)
{
  const it = await V(['alpha', 'beta']);
  const ids = [];
  for await (const v of it) ids.push(v.id());
  assert.deepEqual(ids.sort(), ['alpha', 'beta']);
}

