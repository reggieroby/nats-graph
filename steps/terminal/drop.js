
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
  [operationFactoryKey]({ ctx: { graphBucket } = {} } = {}) {
    async function* itr() {
      const deleteByPattern = async (pattern) => {
        const keys = await graphBucket.keys(pattern)
        for await (const key of keys) {
          await graphBucket.delete(key)
        }
      }
      await Promise.all([
        deleteByPattern('node.*'),
        deleteByPattern('edge.*')
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
  [operationFactoryKey]({ parent: vertexId, ctx: { graphBucket } = {} } = {}) {
    async function* iterator() {
      await graphBucket.delete(`node.${vertexId}`).catch(() => { })

      const nodeKeys = await graphBucket.keys(`node.${vertexId}.*`).catch(() => [])
      for await (const key of nodeKeys) {
        await graphBucket.delete(key).catch(() => { })
      }

      const inboundEdges = await graphBucket.keys('edge.*.incoming').then(Array.fromAsync).catch(() => [])
      const outboundEdges = await graphBucket.keys('edge.*.outgoing').then(Array.fromAsync).catch(() => [])
      const bases = new Set()

      for (const key of inboundEdges) {
        const value = await graphBucket.get(key).then((d) => d.string()).catch(() => null)
        if (value === vertexId) bases.add(key.slice(0, -'.incoming'.length))
      }

      for (const key of outboundEdges) {
        const value = await graphBucket.get(key).then((d) => d.string()).catch(() => null)
        if (value === vertexId) bases.add(key.slice(0, -'.outgoing'.length))
      }

      for (const base of bases) {
        for (const suffix of ['', '.label', '.incoming', '.outgoing']) {
          await graphBucket.delete(`${base}${suffix}`).catch(() => { })
        }
      }

      const outEdgeKeys = await graphBucket.keys(`node.${vertexId}.outE.*`).catch(() => [])
      for await (const key of outEdgeKeys) {
        await graphBucket.delete(key).catch(() => { })
      }
    }

    return { [Symbol.asyncIterator]: iterator }
  }
}

export const dropEdge = {
  [operationNameKey]: operationName.drop,
  [operationResultTypeKey]: operationResultType.value,
  [operationFactoryKey]({ parent: edgeId, ctx: { graphBucket } = {} } = {}) {
    async function* itr() {
      const incoming = await graphBucket.get(`edge.${edgeId}.incoming`).then((d) => d.string()).catch(() => null)
      const outgoing = await graphBucket.get(`edge.${edgeId}.outgoing`).then((d) => d.string()).catch(() => null)
      const label = await graphBucket.get(`edge.${edgeId}.label`).then((d) => d.string()).catch(() => null)

      await graphBucket.delete(`edge.${edgeId}`).catch(() => { })

      const edgeKeys = await graphBucket.keys(`edge.${edgeId}.*`).catch(() => [])
      for await (const key of edgeKeys) {
        await graphBucket.delete(key).catch(() => { })
      }

      if (incoming) {
        await graphBucket.delete(`node.${incoming}.outE.${edgeId}`).catch(() => { })
        if (label) await graphBucket.delete(`node.${incoming}.outE.${label}.${edgeId}`).catch(() => { })
        await removeFromArray(graphBucket, `node.${incoming}.outE.__index`, edgeId)
        if (label) await removeFromArray(graphBucket, `node.${incoming}.outE.${label}.__index`, edgeId)
        if (outgoing) {
          await removeFromArray(graphBucket, `node.${incoming}.outV.__index`, outgoing)
          if (label) await removeFromArray(graphBucket, `node.${incoming}.outV.${label}.__index`, outgoing)
        }
      }

      if (outgoing) {
        await graphBucket.delete(`node.${outgoing}.inE.${edgeId}`).catch(() => { })
        if (label) await graphBucket.delete(`node.${outgoing}.inE.${label}.${edgeId}`).catch(() => { })
        await removeFromArray(graphBucket, `node.${outgoing}.inE.__index`, edgeId)
        if (label) await removeFromArray(graphBucket, `node.${outgoing}.inE.${label}.__index`, edgeId)
        if (incoming) {
          await removeFromArray(graphBucket, `node.${outgoing}.inV.__index`, incoming)
          if (label) await removeFromArray(graphBucket, `node.${outgoing}.inV.${label}.__index`, incoming)
        }
      }

      await graphBucket.delete(`edges.${edgeId}`).catch(() => { })
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}
