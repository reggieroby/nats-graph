import assert from 'node:assert'

import { graph } from '../graph.js'

// explain()
{
  const ex = graph().addV('session').property('x', 1).id().explain();
  assert.ok(typeof ex === 'string');
  assert.ok(ex.includes('addV'));
}

// then/await thenable resolves to Array.fromAsync over chain output
{
  const out = await graph().addV('session').id();
  assert.ok(Array.isArray(out));
  assert.equal(out.length, 1);
  assert.ok(typeof out[0] === 'string');
}

