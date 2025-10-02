import { assert, uniqueID } from '../../config.js'
import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName } from '../types.js'

export const addE = {
  [operationNameKey]: operationName.addE,
  [operationResultTypeKey]: operationResultType.edge,
  [operationFactoryKey]({ ctx: { kvStore }, args: [label, incoming, outgoing] } = {}) {
    // const a = performance.now()
    assert(typeof label === 'string' && label.length, 'type required');
    assert(typeof incoming === 'string' && incoming.length, 'incoming required');
    assert(typeof outgoing === 'string' && outgoing.length, 'outgoing required');

    async function* itr() {
      const id = uniqueID();
      await Promise.all([
        kvStore.create(`edge.${id}`, ""),
        kvStore.create(`edge.${id}.label`, label),
        kvStore.create(`edge.${id}.incoming`, incoming),
        kvStore.create(`edge.${id}.outgoing`, outgoing),
        // Index for V(id).outE(): fast lookup of outgoing edges by vertex and label
        // Generic index (no label filter)
        kvStore.create(`node.${incoming}.outE.${id}`, ""),
        // Label-specific index for targeted scans: node.<vertex>.outE.<label>.<edge>
        kvStore.create(`node.${incoming}.outE.${label}.${id}`, ""),
        // Index for V(id).inE(): fast lookup of incoming edges by vertex and label
        kvStore.create(`node.${outgoing}.inE.${id}`, ""),
        kvStore.create(`node.${outgoing}.inE.${label}.${id}`, ""),
        // Adjacency: vertex -> neighbor vertices (out and in), with label scoping
        kvStore.create(`node.${incoming}.outV.${outgoing}`, ""),
        kvStore.create(`node.${incoming}.outV.${label}.${outgoing}`, ""),
        kvStore.create(`node.${outgoing}.inV.${incoming}`, ""),
        kvStore.create(`node.${outgoing}.inV.${label}.${incoming}`, ""),

      ]).catch(_err => {
        assert(false, `Failed to create edge(${label}):${id} incoming:${incoming} outgoing:${outgoing}`);
      })

      // Maintain compact adjacency arrays to enable 1 read + loop traversal
      const pushUnique = async (key, value) => {
        try {
          let raw = await kvStore.get(key).then(d => d.string()).catch(() => '[]');
          let arr; try { arr = JSON.parse(raw || '[]') } catch { arr = [] }
          if (!Array.isArray(arr)) arr = [];
          if (!arr.includes(value)) {
            arr.push(value);
            await kvStore.update(key, JSON.stringify(arr));
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
      try { await kvStore.create(`edges.${id}`, "") } catch { }
      yield id;
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}
