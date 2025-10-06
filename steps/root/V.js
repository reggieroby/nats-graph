import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName, operationStreamWrapperKey } from '../types.js'


export const V = {
  [operationNameKey]: operationName.V,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationStreamWrapperKey]({ ctx: { kvStore } = {}, args: [idOrIds] = [] } = {}) {
    return (_source) => (async function* () {
      if (Array.isArray(idOrIds)) {
        for (const id of idOrIds) {
          if (!kvStore) continue
          const exists = await kvStore.get(`node.${id}`)
          if (exists) yield id
        }
        return;
      }

      if (idOrIds === undefined || idOrIds === null) {
        if (!kvStore) return
        for await (const key of await kvStore.keys(`node.*`)) {
          yield key.split('.').pop()
        }
        return;
      }

      if (kvStore) {
        const exists = await kvStore.get(`node.${idOrIds}`)
        if (exists) yield idOrIds
      }
    })()
  },
  [operationFactoryKey]({ ctx: { kvStore } = {}, args: [idOrIds] = [] } = {}) {
    async function* itr() {
      if (Array.isArray(idOrIds)) {
        for (const id of idOrIds) {
          if (!kvStore) continue
          const exists = await kvStore.get(`node.${id}`)
          if (exists) yield id
        }
        return;
      }

      if (idOrIds === undefined || idOrIds === null) {
        if (!kvStore) return
        for await (const key of await kvStore.keys(`node.*`)) {
          yield key.split('.').pop()
        }
        return;
      }

      // Single id: only yield if present in storage
      if (kvStore) {
        const exists = await kvStore.get(`node.${idOrIds}`)
        if (exists) yield idOrIds
      }
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}

// Lightweight vertex reference when id is already known (from index)
export async function VRef(id) {
  async function* itr() {
    if (id != null) yield id;
  }
  return {
    [Symbol.asyncIterator]: itr,
  };
}
