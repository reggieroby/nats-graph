import assert from 'node:assert'

import { bucket } from '../bucket.js'
import { addV } from '../addV.js'
import { addE } from '../addE.js'
import { E } from '../E.js'

// Create two vertices
const [v1] = await Array.fromAsync(await addV('n1'));
const [v2] = await Array.fromAsync(await addV('n2'));

const id1 = v1.id();
const id2 = v2.id();

// Create edge
const edgeIter = await addE('connects', id1, id2);
const edges = await Array.fromAsync(edgeIter);
assert.equal(edges.length, 1);
const e = edges[0];
assert.equal(await e.label(), 'connects');
assert.ok(e.id());

// Set edge property via E(id)
{
  const [edgeAgain] = await Array.fromAsync(await E(e.id()));
  await edgeAgain.property('weight', 5);
}
