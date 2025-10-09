import { uniqueID } from '../../config.js'
import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName, operationStreamWrapperKey, Errors } from '../types.js'

export const addE = {
  [operationNameKey]: operationName.addE,
  [operationResultTypeKey]: operationResultType.edge,
  [operationStreamWrapperKey]({
    ctx: { kvStore, diagnostics } = {},
    args: [label, incoming, outgoing] = []
  } = {}) {
    return (_source) => (async function* () {
      diagnostics?.require(typeof label === 'string' && label.length, Errors.EDGE_LABEL_REQUIRED, 'type required', { label });
      diagnostics?.require(typeof incoming === 'string' && incoming.length, Errors.EDGE_INCOMING_REQUIRED, 'incoming required', { incoming });
      diagnostics?.require(typeof outgoing === 'string' && outgoing.length, Errors.EDGE_OUTGOING_REQUIRED, 'outgoing required', { outgoing });

      const [inExists, outExists] = await Promise.all([
        kvStore.get(`node.${incoming}`),
        kvStore.get(`node.${outgoing}`),
      ])
      diagnostics?.require(!!inExists, Errors.EDGE_INCOMING_MISSING, `incoming vertex does not exist: ${incoming}`, { incoming });
      diagnostics?.require(!!outExists, Errors.EDGE_OUTGOING_MISSING, `outgoing vertex does not exist: ${outgoing}`, { outgoing });

      const id = uniqueID();
      await Promise.all([
        kvStore.create(`edge.${id}`, ""),
        kvStore.create(`edge.${id}.label`, label),
        kvStore.create(`edge.${id}.incoming`, incoming),
        kvStore.create(`edge.${id}.outgoing`, outgoing),
        kvStore.create(`node.${incoming}.outE.${id}`, ""),
        kvStore.create(`node.${incoming}.outE.${label}.${id}`, ""),
        kvStore.create(`node.${outgoing}.inE.${id}`, ""),
        kvStore.create(`node.${outgoing}.inE.${label}.${id}`, ""),
        kvStore.put(`node.${incoming}.outV.${outgoing}`, ""),
        kvStore.put(`node.${incoming}.outV.${label}.${outgoing}`, ""),
        kvStore.put(`node.${outgoing}.inV.${incoming}`, ""),
        kvStore.put(`node.${outgoing}.inV.${label}.${incoming}`, ""),
      ])

      const pushUnique = async (key, value) => {
        try {
          let raw = await kvStore.get(key).then(d => d.string()).catch(() => '[]');
          let arr; try { arr = JSON.parse(raw || '[]') } catch { arr = [] }
          if (!Array.isArray(arr)) arr = [];
          if (!arr.includes(value)) {
            arr.push(value);
            await kvStore.update(key, JSON.stringify(arr));
          }
        } catch { }
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

      try { await kvStore.create(`edges.${id}`, "") } catch { }
      yield id;
    })()
  },
  [operationFactoryKey]({
    ctx: { kvStore, diagnostics } = {},
    args: [label, incoming, outgoing] } = {}
  ) {
    diagnostics?.require(typeof label === 'string' && label.length, Errors.EDGE_LABEL_REQUIRED, 'type required', { label });
    diagnostics?.require(typeof incoming === 'string' && incoming.length, Errors.EDGE_INCOMING_REQUIRED, 'incoming required', { incoming });
    diagnostics?.require(typeof outgoing === 'string' && outgoing.length, Errors.EDGE_OUTGOING_REQUIRED, 'outgoing required', { outgoing });

    async function* itr() {
      // Ensure both endpoint vertices exist before creating the edge
      const [inExists, outExists] = await Promise.all([
        kvStore.get(`node.${incoming}`),
        kvStore.get(`node.${outgoing}`),
      ])
      diagnostics?.require(!!inExists, Errors.EDGE_INCOMING_MISSING, `incoming vertex does not exist: ${incoming}`, { incoming });
      diagnostics?.require(!!outExists, Errors.EDGE_OUTGOING_MISSING, `outgoing vertex does not exist: ${outgoing}`, { outgoing });

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
        // These keys are idempotent per vertex pair, so use put() to avoid
        // duplicate-key errors when multiple edges connect the same vertices.
        kvStore.put(`node.${incoming}.outV.${outgoing}`, ""),
        kvStore.put(`node.${incoming}.outV.${label}.${outgoing}`, ""),
        kvStore.put(`node.${outgoing}.inV.${incoming}`, ""),
        kvStore.put(`node.${outgoing}.inV.${label}.${incoming}`, ""),

      ])

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
