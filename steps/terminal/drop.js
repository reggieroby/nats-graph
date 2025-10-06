
import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName, operationStreamWrapperKey } from '../types.js'

const removeFromArray = async (store, key, value) => {
  const raw = await store.get(key).then((d) => d.string()).catch(() => '[]')
  let items
  try { items = JSON.parse(raw || '[]') } catch { items = [] }
  if (!Array.isArray(items)) items = []
  const next = items.filter((entry) => String(entry) !== String(value))
  await store.update(key, JSON.stringify(next)).catch(() => { })
}

// Internal helper to remove an edge and all its indices/adjacency entries
const dropEdgeById = async (kvStore, edgeId) => {
  const incoming = await kvStore.get(`edge.${edgeId}.incoming`).then((d) => d.string()).catch(() => null)
  const outgoing = await kvStore.get(`edge.${edgeId}.outgoing`).then((d) => d.string()).catch(() => null)
  const label = await kvStore.get(`edge.${edgeId}.label`).then((d) => d.string()).catch(() => null)

  await kvStore.delete(`edge.${edgeId}`).catch(() => { })

  const edgeKeys = await kvStore.keys(`edge.${edgeId}.*`).catch(() => [])
  for await (const key of edgeKeys) {
    await kvStore.delete(key).catch(() => { })
  }

  if (incoming) {
    await kvStore.delete(`node.${incoming}.outE.${edgeId}`).catch(() => { })
    if (label) await kvStore.delete(`node.${incoming}.outE.${label}.${edgeId}`).catch(() => { })
    await removeFromArray(kvStore, `node.${incoming}.outE.__index`, edgeId)
    if (label) await removeFromArray(kvStore, `node.${incoming}.outE.${label}.__index`, edgeId)
    if (outgoing) {
      await removeFromArray(kvStore, `node.${incoming}.outV.__index`, outgoing)
      if (label) await removeFromArray(kvStore, `node.${incoming}.outV.${label}.__index`, outgoing)
    }
  }

  if (outgoing) {
    await kvStore.delete(`node.${outgoing}.inE.${edgeId}`).catch(() => { })
    if (label) await kvStore.delete(`node.${outgoing}.inE.${label}.${edgeId}`).catch(() => { })
    await removeFromArray(kvStore, `node.${outgoing}.inE.__index`, edgeId)
    if (label) await removeFromArray(kvStore, `node.${outgoing}.inE.${label}.__index`, edgeId)
    if (incoming) {
      await removeFromArray(kvStore, `node.${outgoing}.inV.__index`, incoming)
      if (label) await removeFromArray(kvStore, `node.${outgoing}.inV.${label}.__index`, incoming)
    }
  }

  await kvStore.delete(`edges.${edgeId}`).catch(() => { })

  return { incoming, outgoing, label }
}

export const dropGraph = {
  [operationNameKey]: operationName.drop,
  [operationResultTypeKey]: operationResultType.value,
  [operationStreamWrapperKey]({ ctx: { kvStore } = {} } = {}) {
    return (_source) => (async function* () {
      const deleteByPattern = async (pattern) => {
        const keys = await kvStore.keys(pattern)
        for await (const key of keys) {
          await kvStore.delete(key)
        }
      }
      await Promise.all([
        deleteByPattern('node.>'),
        deleteByPattern('edge.>')
      ])
    })()
  },
  [operationFactoryKey]({ ctx: { kvStore } = {} } = {}) {
    async function* itr() {
      const deleteByPattern = async (pattern) => {
        const keys = await kvStore.keys(pattern)
        for await (const key of keys) {
          await kvStore.delete(key)
        }
      }
      await Promise.all([
        deleteByPattern('node.>'),
        deleteByPattern('edge.>')
      ])
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}

export const dropVertex = {
  [operationNameKey]: operationName.drop,
  [operationResultTypeKey]: operationResultType.value,
  [operationStreamWrapperKey]({ ctx: { kvStore } = {} } = {}) {
    return (source) => (async function* () {
      for await (const vertexId of source) {
        const incident = new Set()

        // Gather incident edge IDs from indices (fast path)
        const loadIndex = async (key) => {
          const raw = await kvStore.get(key).then((d) => d.string()).catch(() => '[]')
          try {
            const arr = JSON.parse(raw || '[]')
            if (Array.isArray(arr)) arr.forEach((id) => incident.add(String(id)))
          } catch { }
        }
        await Promise.all([
          loadIndex(`node.${vertexId}.outE.__index`),
          loadIndex(`node.${vertexId}.inE.__index`)
        ])

        // If indices are missing, fall back to scanning keys
        if (incident.size === 0) {
          const outKeys = await kvStore.keys(`node.${vertexId}.outE.*`).catch(() => [])
          for await (const key of outKeys) {
            const tail = key.split('.').pop()
            if (tail && tail !== '__index') incident.add(tail)
          }
          const inKeys = await kvStore.keys(`node.${vertexId}.inE.*`).catch(() => [])
          for await (const key of inKeys) {
            const tail = key.split('.').pop()
            if (tail && tail !== '__index') incident.add(tail)
          }
        }

        // Track neighbor adjacency to clean up boolean outV/inV keys on neighbors
        const neighborAdjDeletes = new Set()

        for (const edgeId of incident) {
          const { incoming, outgoing, label } = await dropEdgeById(kvStore, edgeId)
          if (incoming === vertexId && outgoing) {
            // Remove neighbor's inV reference to this vertex
            neighborAdjDeletes.add(JSON.stringify({ side: 'inV', neighbor: outgoing, label: label || '', me: vertexId }))
          }
          if (outgoing === vertexId && incoming) {
            // Remove neighbor's outV reference to this vertex
            neighborAdjDeletes.add(JSON.stringify({ side: 'outV', neighbor: incoming, label: label || '', me: vertexId }))
          }
        }

        for (const item of neighborAdjDeletes) {
          const { side, neighbor, label, me } = JSON.parse(item)
          await kvStore.delete(`node.${neighbor}.${side}.${me}`).catch(() => { })
          if (label) await kvStore.delete(`node.${neighbor}.${side}.${label}.${me}`).catch(() => { })
        }

        // Finally remove the vertex and all its keys
        await kvStore.delete(`node.${vertexId}`).catch(() => { })
        const nodeKeys = await kvStore.keys(`node.${vertexId}.*`).catch(() => [])
        for await (const key of nodeKeys) {
          await kvStore.delete(key).catch(() => { })
        }
      }
    })()
  },
  [operationFactoryKey]({ parent: vertexId, ctx: { kvStore } = {} } = {}) {
    async function* iterator() {
      const incident = new Set()

      const loadIndex = async (key) => {
        const raw = await kvStore.get(key).then((d) => d.string()).catch(() => '[]')
        try {
          const arr = JSON.parse(raw || '[]')
          if (Array.isArray(arr)) arr.forEach((id) => incident.add(String(id)))
        } catch { }
      }
      await Promise.all([
        loadIndex(`node.${vertexId}.outE.__index`),
        loadIndex(`node.${vertexId}.inE.__index`)
      ])

      if (incident.size === 0) {
        const outKeys = await kvStore.keys(`node.${vertexId}.outE.*`).catch(() => [])
        for await (const key of outKeys) {
          const tail = key.split('.').pop()
          if (tail && tail !== '__index') incident.add(tail)
        }
        const inKeys = await kvStore.keys(`node.${vertexId}.inE.*`).catch(() => [])
        for await (const key of inKeys) {
          const tail = key.split('.').pop()
          if (tail && tail !== '__index') incident.add(tail)
        }
      }

      const neighborAdjDeletes = new Set()
      for (const edgeId of incident) {
        const { incoming, outgoing, label } = await dropEdgeById(kvStore, edgeId)
        if (incoming === vertexId && outgoing) {
          neighborAdjDeletes.add(JSON.stringify({ side: 'inV', neighbor: outgoing, label: label || '', me: vertexId }))
        }
        if (outgoing === vertexId && incoming) {
          neighborAdjDeletes.add(JSON.stringify({ side: 'outV', neighbor: incoming, label: label || '', me: vertexId }))
        }
      }

      for (const item of neighborAdjDeletes) {
        const { side, neighbor, label, me } = JSON.parse(item)
        await kvStore.delete(`node.${neighbor}.${side}.${me}`).catch(() => { })
        if (label) await kvStore.delete(`node.${neighbor}.${side}.${label}.${me}`).catch(() => { })
      }

      await kvStore.delete(`node.${vertexId}`).catch(() => { })
      const nodeKeys = await kvStore.keys(`node.${vertexId}.*`).catch(() => [])
      for await (const key of nodeKeys) {
        await kvStore.delete(key).catch(() => { })
      }
    }

    return { [Symbol.asyncIterator]: iterator }
  }
}

export const dropEdge = {
  [operationNameKey]: operationName.drop,
  [operationResultTypeKey]: operationResultType.value,
  [operationStreamWrapperKey]({ ctx: { kvStore } = {} } = {}) {
    return (source) => (async function* () {
      for await (const edgeId of source) {
        await dropEdgeById(kvStore, edgeId)
      }
    })()
  },
  [operationFactoryKey]({ parent: edgeId, ctx: { kvStore } = {} } = {}) {
    async function* itr() {
      await dropEdgeById(kvStore, edgeId)
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}
