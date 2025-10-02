
import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName } from '../types.js'

const removeFromArray = async (store, key, value) => {
  const raw = await store.get(key).then((d) => d.string()).catch(() => '[]')
  let items
  try { items = JSON.parse(raw || '[]') } catch { items = [] }
  if (!Array.isArray(items)) items = []
  const next = items.filter((entry) => String(entry) !== String(value))
  await store.update(key, JSON.stringify(next)).catch(() => { })
}

export const dropGraph = {
  [operationNameKey]: operationName.drop,
  [operationResultTypeKey]: operationResultType.value,
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
  [operationFactoryKey]({ parent: vertexId, ctx: { kvStore } = {} } = {}) {
    async function* iterator() {
      await kvStore.delete(`node.${vertexId}`).catch(() => { })

      const nodeKeys = await kvStore.keys(`node.${vertexId}.*`).catch(() => [])
      for await (const key of nodeKeys) {
        await kvStore.delete(key).catch(() => { })
      }

      const inboundEdges = await kvStore.keys('edge.*.incoming').then(Array.fromAsync).catch(() => [])
      const outboundEdges = await kvStore.keys('edge.*.outgoing').then(Array.fromAsync).catch(() => [])
      const bases = new Set()

      for (const key of inboundEdges) {
        const value = await kvStore.get(key).then((d) => d.string()).catch(() => null)
        if (value === vertexId) bases.add(key.slice(0, -'.incoming'.length))
      }

      for (const key of outboundEdges) {
        const value = await kvStore.get(key).then((d) => d.string()).catch(() => null)
        if (value === vertexId) bases.add(key.slice(0, -'.outgoing'.length))
      }

      for (const base of bases) {
        for (const suffix of ['', '.label', '.incoming', '.outgoing']) {
          await kvStore.delete(`${base}${suffix}`).catch(() => { })
        }
      }

      const outEdgeKeys = await kvStore.keys(`node.${vertexId}.outE.*`).catch(() => [])
      for await (const key of outEdgeKeys) {
        await kvStore.delete(key).catch(() => { })
      }
    }

    return { [Symbol.asyncIterator]: iterator }
  }
}

export const dropEdge = {
  [operationNameKey]: operationName.drop,
  [operationResultTypeKey]: operationResultType.value,
  [operationFactoryKey]({ parent: edgeId, ctx: { kvStore } = {} } = {}) {
    async function* itr() {
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
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}
