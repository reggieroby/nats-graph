import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName } from '../types.js'


export const V = {
  [operationNameKey]: operationName.V,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationFactoryKey]({ ctx: { graphBucket } = {}, args: [idOrIds] } = {}) {
    async function* itr() {
      if (Array.isArray(idOrIds)) {
        for (const id of idOrIds) {
          yield id;
        }
        return;
      }

      if (idOrIds === undefined || idOrIds === null) {
        for await (const key of await graphBucket.keys(`node.*`)) {
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
