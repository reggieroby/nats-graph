import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName } from '../types.js'

export const vertexLabel = {
  [operationNameKey]: operationName.label,
  [operationResultTypeKey]: operationResultType.value,
  [operationFactoryKey]({ parent: vertexId, ctx: { kvStore } } = {}) {
    async function* itr() {
      yield await kvStore.get(`node.${vertexId}.label`).then((data) => data.string())
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}

export const edgeLabel = {
  [operationNameKey]: operationName.label,
  [operationResultTypeKey]: operationResultType.value,
  [operationFactoryKey]({ parent: edgeId, ctx: { kvStore } } = {}) {
    async function* itr() {
      yield await kvStore.get(`edge.${edgeId}.label`).then((data) => data.string())
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}
