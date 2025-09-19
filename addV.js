import { assert, ulid } from './config.js'
import { bucket } from './bucket.js'
import { V } from './V.js';

export async function addV(label) {
  assert(typeof label === 'string' && label.length, 'type required');
  const id = ulid();
  const bkt = await bucket();
  await Promise.all([
    bkt.create(`node.${id}`, ""),
    bkt.create(`node.${id}.label`, label),
    bkt.create(`nodes.${id}`, "")// Global vertex index for fast V() iteration
  ]).catch(_err => {
    assert(false, `Failed to create node(${label}):${id}`);
  })

  async function* itr() {
    yield* await V(id)
  }

  return { [Symbol.asyncIterator]: itr };
}
