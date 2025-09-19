import { bucket } from './bucket.js'
import { vertexLabel } from './label.js'
import { E, ERef } from './E.js'
import { setVertexProperty, getVertexProperty } from './property.js'

export async function V(idOrIds) {
  const b = await bucket();
  async function* itr() {
    if (Array.isArray(idOrIds)) {
      for (const id of idOrIds) {
        yield props(id);
      }
      return;
    }

    if (idOrIds === undefined || idOrIds === null) {
      // Prefer dedicated index for vertices to avoid scanning all node.* keys
      for await (const key of await b.keys(`nodes.*`)) {
        const id = key.split('.').pop();
        if (!id) continue;
        yield props(id);
      }
      return;
    }

    // Single id: yield one vertex
    yield props(idOrIds);
  }

  return { [Symbol.asyncIterator]: itr };
}

// Lightweight vertex reference when id is already known (from index)
export async function VRef(id) {
  const b = await bucket(); // ensure initialized
  async function* itr() { yield props(id) }
  return { [Symbol.asyncIterator]: itr };
}

const props = (id) => ({
  //command filter
  property: async (k, v) => setVertexProperty(id, k, v).then(() => V(id)),
  has: (k, v) => (async function* () {
    try {
      if (k === 'label') {
        const lbl = await vertexLabel(id).catch(() => undefined);
        if (lbl === v || String(lbl) === String(v)) { yield* await V(id); }
        return;
      }
      const b = await bucket();
      let raw;
      try { raw = await b.get(`node.${id}.property.${k}`).then(d => d.string()) } catch { raw = undefined }
      let parsed = raw;
      try { parsed = JSON.parse(raw) } catch { /* keep raw */ }
      if (parsed === v || String(parsed) === String(v)) { yield* await V(id); }
    } catch { /* no match */ }
  })(),
  // navigation
  outE: (...labels) => (async function* () {
    const want = new Set(labels.filter(Boolean).map(String));
    const b = await bucket();
    let matched = 0;
    const parseArr = async (key) => {
      try {
        const s = await b.get(key).then(d => d.string()).catch(() => '[]');
        const arr = JSON.parse(s || '[]');
        return Array.isArray(arr) ? arr : [];
      } catch { return [] }
    };
    try {
      if (want.size > 0) {
        const seen = new Set();
        for (const lab of want) {
          const list = await parseArr(`node.${id}.outE.${lab}.__index`);
          for (const eid of list) { if (!eid || seen.has(eid)) continue; seen.add(eid); matched++; yield* await ERef(eid) }
        }
      } else {
        const list = await parseArr(`node.${id}.outE.__index`);
        for (const eid of list) { if (!eid) continue; matched++; yield* await ERef(eid) }
      }
    } catch { /* ignore */ }
  })(),
  out: (...labels) => (async function* () {
    const want = new Set(labels.filter(Boolean).map(String));
    const b = await bucket();
    const seen = new Set();
    try {
      if (want.size > 0) {
        for (const lab of want) {
          for await (const k of await b.keys(`node.${id}.outV.${lab}.*`)) {
            const toId = k.split('.').pop();
            if (!toId || seen.has(toId)) continue;
            seen.add(toId);
            yield* await VRef(toId);
          }
        }
      } else {
        for await (const k of await b.keys(`node.${id}.outV.*`)) {
          const toId = k.split('.').pop();
          if (!toId || seen.has(toId)) continue;
          seen.add(toId);
          yield* await VRef(toId);
        }
      }
    } catch { /* ignore */ }
  })(),
  inE: (...labels) => (async function* () {
    const want = new Set(labels.filter(Boolean).map(String));
    const b = await bucket();
    let matched = 0;
    try {
      if (want.size > 0) {
        for (const lab of want) {
          for await (const k of await b.keys(`node.${id}.inE.${lab}.*`)) {
            const eid = k.split('.').pop();
            if (!eid) continue;
            matched++;
            yield* await ERef(eid);
          }
        }
      } else {
        for await (const k of await b.keys(`node.${id}.inE.*`)) {
          const eid = k.split('.').pop();
          if (!eid) continue;
          matched++;
          yield* await ERef(eid);
        }
      }
    } catch { /* ignore */ }
  })(),
  in: (...labels) => (async function* () {
    const want = new Set(labels.filter(Boolean).map(String));
    const b = await bucket();
    const seen = new Set();
    try {
      if (want.size > 0) {
        for (const lab of want) {
          for await (const k of await b.keys(`node.${id}.inV.${lab}.*`)) {
            const fromId = k.split('.').pop();
            if (!fromId || seen.has(fromId)) continue;
            seen.add(fromId);
            yield* await VRef(fromId);
          }
        }
      } else {
        for await (const k of await b.keys(`node.${id}.inV.*`)) {
          const fromId = k.split('.').pop();
          if (!fromId || seen.has(fromId)) continue;
          seen.add(fromId);
          yield* await VRef(fromId);
        }
      }
    } catch { /* ignore */ }
  })(),
  bothE: (...labels) => (async function* () {
    const want = new Set(labels.filter(Boolean).map(String));
    const b = await bucket();
    const seen = new Set();
    try {
      if (want.size > 0) {
        for (const lab of want) {
          for await (const k of await b.keys(`node.${id}.outE.${lab}.*`)) {
            const eid = k.split('.').pop(); if (!eid || seen.has(eid)) continue; seen.add(eid); yield* await ERef(eid);
          }
          for await (const k of await b.keys(`node.${id}.inE.${lab}.*`)) {
            const eid = k.split('.').pop(); if (!eid || seen.has(eid)) continue; seen.add(eid); yield* await ERef(eid);
          }
        }
      } else {
        for await (const k of await b.keys(`node.${id}.outE.*`)) {
          const eid = k.split('.').pop(); if (!eid || seen.has(eid)) continue; seen.add(eid); yield* await ERef(eid);
        }
        for await (const k of await b.keys(`node.${id}.inE.*`)) {
          const eid = k.split('.').pop(); if (!eid || seen.has(eid)) continue; seen.add(eid); yield* await ERef(eid);
        }
      }
    } catch { /* ignore */ }
  })(),
  drop: async () => {
    const b = await bucket();
    try { await b.delete(`node.${id}`) } catch { }
    try {
      for await (const k of await b.keys(`node.${id}.*`)) {
        try { await b.delete(k) } catch { }
      }
    } catch { }
    try {
      const bases = new Set();
      const inKeys = await b.keys(`edge.*.incoming`).then(Array.fromAsync).catch(() => []);
      for (const k of inKeys) {
        const val = await b.get(k).then(d => d.string()).catch(() => null);
        if (val === id) bases.add(k.slice(0, -'.incoming'.length));
      }
      const outKeys = await b.keys(`edge.*.outgoing`).then(Array.fromAsync).catch(() => []);
      for (const k of outKeys) {
        const val = await b.get(k).then(d => d.string()).catch(() => null);
        if (val === id) bases.add(k.slice(0, -'.outgoing'.length));
      }
      for (const base of bases) {
        for (const suf of ['', '.label', '.incoming', '.outgoing']) {
          try { await b.delete(`${base}${suf}`) } catch { }
        }
      }
      // remove index entries for outE on this vertex
      try {
        for await (const k of await b.keys(`node.${id}.outE.*`)) {
          try { await b.delete(k) } catch { }
        }
      } catch { }
    } catch { }
    return 'ok';
  },


  //query terminal
  id: () => id,
  label: async () => vertexLabel(id),
  properties: async (k) => getVertexProperty(id, k),
  valueMap: async () => {
    const b = await bucket();
    const out = {};
    try {
      const keys = await b.keys(`node.${id}.property.*`).then(Array.fromAsync).catch(() => []);
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
})
