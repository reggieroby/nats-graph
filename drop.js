import { bucket } from './bucket.js'

// Root-level drop: delete all vertices and edges (and their properties)
export async function drop() {
  const b = await bucket();
  // Helper to delete all keys matching a pattern
  const delAll = async (pattern) => {
    try {
      for await (const k of await b.keys(pattern)) {
        try { await b.delete(k) } catch { /* ignore individual delete errors */ }
      }
    } catch { /* ignore */ }
  };

  await Promise.all([
    delAll('node.*'),
    delAll('edge.*'),
  ]);

  return 'ok';
}

