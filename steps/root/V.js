import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName } from '../types.js'


export const V = {
  [operationNameKey]: operationName.V,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationFactoryKey]({ ctx: { kvStore } = {}, args: [idOrIds] } = {}) {
    async function* itr() {
      if (Array.isArray(idOrIds)) {
        for (const id of idOrIds) {
          yield id;
        }
        return;
      }

      if (idOrIds === undefined || idOrIds === null) {
        console.log('we need kvstore.keys.....', kvStore.keys)
        for await (const key of await kvStore.keys(`node.*`)) {
          yield key.split('.').pop()
        }
        return;
      }

      // Single id: yield one vertex
      yield idOrIds;
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
