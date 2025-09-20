import { assert, ulid } from './config.js'
import { bucket } from './bucket.js'
import { E } from './E.js';

export async function addE(label, incoming, outgoing) {
  // const a = performance.now()
  assert(typeof label === 'string' && label.length, 'type required');
  assert(typeof incoming === 'string' && incoming.length, 'incoming required');
  assert(typeof outgoing === 'string' && outgoing.length, 'outgoing required');
  const id = ulid();
  const bkt = await bucket();
  await Promise.all([
    bkt.create(`edge.${id}`, ""),
    bkt.create(`edge.${id}.label`, label),
    bkt.create(`edge.${id}.incoming`, incoming),
    bkt.create(`edge.${id}.outgoing`, outgoing),
    // Index for V(id).outE(): fast lookup of outgoing edges by vertex and label
    // Generic index (no label filter)
    bkt.create(`node.${incoming}.outE.${id}`, ""),
    // Label-specific index for targeted scans: node.<vertex>.outE.<label>.<edge>
    bkt.create(`node.${incoming}.outE.${label}.${id}`, ""),
    // Index for V(id).inE(): fast lookup of incoming edges by vertex and label
    bkt.create(`node.${outgoing}.inE.${id}`, ""),
    bkt.create(`node.${outgoing}.inE.${label}.${id}`, ""),
    // Adjacency: vertex -> neighbor vertices (out and in), with label scoping
    bkt.create(`node.${incoming}.outV.${outgoing}`, ""),
    bkt.create(`node.${incoming}.outV.${label}.${outgoing}`, ""),
    bkt.create(`node.${outgoing}.inV.${incoming}`, ""),
    bkt.create(`node.${outgoing}.inV.${label}.${incoming}`, ""),

  ]).catch(_err => {
    assert(false, `Failed to create edge(${label}):${id} incoming:${incoming} outgoing:${outgoing}`);
  })

  // Maintain compact adjacency arrays to enable 1 read + loop traversal
  const pushUnique = async (key, value) => {
    try {
      let raw = await bkt.get(key).then(d => d.string()).catch(() => '[]');
      let arr; try { arr = JSON.parse(raw || '[]') } catch { arr = [] }
      if (!Array.isArray(arr)) arr = [];
      if (!arr.includes(value)) {
        arr.push(value);
        await bkt.put(key, JSON.stringify(arr));
      }
    } catch { /* ignore */ }
  };
  await Promise.all([
    pushUnique(`node.${incoming}.outE.__index`, id),
    pushUnique(`node.${incoming}.outE.${label}.__index`, id),
    pushUnique(`node.${outgoing}.inE.__index`, id),
    pushUnique(`node.${outgoing}.inE.${label}.__index`, id),
    pushUnique(`node.${incoming}.outV.__index`, outgoing),
    pushUnique(`node.${incoming}.outV.${label}.__index`, outgoing),
    pushUnique(`node.${outgoing}.inV.__index`, incoming),
    pushUnique(`node.${outgoing}.inV.${label}.__index`, incoming),
  ]);

  // Global edge index for fast E() iteration
  try { await (await bucket()).create(`edges.${id}`, "") } catch { }

  // const b = performance.now()
  // console.log((b - a), { a, b })
  async function* itr() {
    yield* await E(id);
  }

  return { [Symbol.asyncIterator]: itr };

}
