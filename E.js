import { bucket as get } from './bucket.js'
import { edgeLabel } from './label.js'
import { setEdgeProperty, getEdgeProperty } from './property.js'
import { V } from './V.js'

export async function E(idOrIds) {
  const b = await get();

  const props = (id) => ({
    // command mutation
    property: async (k, v) => setEdgeProperty(id, k, v).then(() => E(id)),
    drop: async () => {
      const b = await get();
      // Read index-related values before deleting edge keys
      let inc = null, out = null, lbl = null;
      try { inc = await b.get(`edge.${id}.incoming`).then(d => d.string()) } catch { inc = null }
      try { out = await b.get(`edge.${id}.outgoing`).then(d => d.string()) } catch { out = null }
      try { lbl = await b.get(`edge.${id}.label`).then(d => d.string()) } catch { lbl = null }
      // Remove edge base and properties
      try { await b.delete(`edge.${id}`) } catch { }
      try {
        for await (const k of await b.keys(`edge.${id}.*`)) {
          try { await b.delete(k) } catch { }
        }
      } catch { }
      // Remove outE index entries if present
      if (inc) {
        try { await b.delete(`node.${inc}.outE.${id}`) } catch { }
        if (lbl) {
          try { await b.delete(`node.${inc}.outE.${lbl}.${id}`) } catch { }
        }
        // Remove array indexes
        const removeFromArray = async (key, value) => {
          try {
            let raw = await b.get(key).then(d => d.string()).catch(() => '[]');
            let arr; try { arr = JSON.parse(raw || '[]') } catch { arr = [] }
            if (!Array.isArray(arr)) arr = [];
            const next = arr.filter(x => String(x) !== String(value));
            await b.put(key, JSON.stringify(next));
          } catch { }
        };
        await removeFromArray(`node.${inc}.outE.__index`, id);
        if (lbl) await removeFromArray(`node.${inc}.outE.${lbl}.__index`, id);
        if (out) {
          await removeFromArray(`node.${inc}.outV.__index`, out);
          if (lbl) await removeFromArray(`node.${inc}.outV.${lbl}.__index`, out);
        }
      }
      if (out) {
        try { await b.delete(`node.${out}.inE.${id}`) } catch { }
        if (lbl) {
          try { await b.delete(`node.${out}.inE.${lbl}.${id}`) } catch { }
        }
        const removeFromArray = async (key, value) => {
          try {
            let raw = await b.get(key).then(d => d.string()).catch(() => '[]');
            let arr; try { arr = JSON.parse(raw || '[]') } catch { arr = [] }
            if (!Array.isArray(arr)) arr = [];
            const next = arr.filter(x => String(x) !== String(value));
            await b.put(key, JSON.stringify(next));
          } catch { }
        };
        await removeFromArray(`node.${out}.inE.__index`, id);
        if (lbl) await removeFromArray(`node.${out}.inE.${lbl}.__index`, id);
        if (inc) {
          await removeFromArray(`node.${out}.inV.__index`, inc);
          if (lbl) await removeFromArray(`node.${out}.inV.${lbl}.__index`, inc);
        }
      }
      return 'ok';
    },

    // query terminal
    label: async () => edgeLabel(id),
    id: () => id,
    properties: async (k) => getEdgeProperty(id, k),
    has: (k, v) => (async function* () {
      try {
        if (k === 'label') {
          const lbl = await edgeLabel(id).catch(() => undefined);
          if (lbl === v || String(lbl) === String(v)) { yield* await E(id); }
          return;
        }
        const b = await get();
        let raw;
        try { raw = await b.get(`edge.${id}.property.${k}`).then(d => d.string()) } catch { raw = undefined }
        let parsed = raw;
        try { parsed = JSON.parse(raw) } catch { /* keep raw */ }
        if (parsed === v || String(parsed) === String(v)) { yield* await E(id); }
      } catch { /* no match */ }
    })(),
    valueMap: async () => {
      const b = await get();
      const out = {};
      try {
        const keys = await b.keys(`edge.${id}.property.*`).then(Array.fromAsync).catch(() => []);
        for (const k of keys) {
          const keyName = k.split('.').pop();
          try {
            const data = await b.get(k);
            const s = await data.string();
            try { out[keyName] = JSON.parse(s) } catch { out[keyName] = s }
          } catch { /* ignore individual property read errors */ }
        }
      } catch { /* ignore */ }
      return out;
    },
    // navigation: edge -> vertices
    outV: (/* no labels */) => (async function* () {
      const b = await get();
      try {
        let toId = null;
        try { toId = await b.get(`edge.${id}.outgoing`).then(d => d.string()) } catch { toId = null }
        if (toId) {
          yield* await V(toId);
        }
      } catch { /* ignore */ }
    })(),
    inV: (/* no labels */) => (async function* () {
      const b = await get();
      try {
        let fromId = null;
        try { fromId = await b.get(`edge.${id}.incoming`).then(d => d.string()) } catch { fromId = null }
        if (fromId) {
          yield* await V(fromId);
        }
      } catch { /* ignore */ }
    })(),
    bothV: (/* no labels */) => (async function* () {
      const b = await get();
      try {
        let fromId = null;
        let toId = null;
        try { fromId = await b.get(`edge.${id}.incoming`).then(d => d.string()) } catch { fromId = null }
        try { toId = await b.get(`edge.${id}.outgoing`).then(d => d.string()) } catch { toId = null }
        const seen = new Set();
        if (fromId && !seen.has(fromId)) { seen.add(fromId); yield* await V(fromId); }
        if (toId && !seen.has(toId)) { seen.add(toId); yield* await V(toId); }
      } catch { /* ignore */ }
    })(),
    otherV: (knownId) => (async function* () {
      const b = await get();
      try {
        let fromId = null;
        let toId = null;
        try { fromId = await b.get(`edge.${id}.incoming`).then(d => d.string()) } catch { fromId = null }
        try { toId = await b.get(`edge.${id}.outgoing`).then(d => d.string()) } catch { toId = null }
        const k = knownId != null ? String(knownId) : null;
        if (k && fromId === k && toId) { yield* await V(toId); return; }
        if (k && toId === k && fromId) { yield* await V(fromId); return; }
        if (toId) { yield* await V(toId); return; }
        if (fromId) { yield* await V(fromId); return; }
      } catch { /* ignore */ }
    })(),
  });

  async function* itr() {
    if (Array.isArray(idOrIds)) {
      for (const id of idOrIds) {
        yield props(id);
      }
      return;
    }

    if (idOrIds === undefined || idOrIds === null) {
      // Prefer dedicated index for edges to avoid scanning all edge.* keys
      for await (const key of await b.keys(`edges.*`)) {
        const id = key.split('.').pop();
        if (!id) continue;
        yield props(id);
      }
      return;
    }

    // Single id
    yield props(idOrIds);
  }

  return { [Symbol.asyncIterator]: itr };
}

// Lightweight edge reference: yields a single edge object without any lookups.
// This avoids the per-call bucket init overhead in E(id) when the caller already
// knows the specific edge id from an index and only needs a handle.
export async function ERef(id) {
  const b = await get(); // ensure bucket is initialized once per batch context
  async function* itr() { yield props(id) }
  return { [Symbol.asyncIterator]: itr };
}
