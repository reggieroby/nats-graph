import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName, operationStreamWrapperKey } from '../types.js'

export const vertexLabel = {
  [operationNameKey]: operationName.label,
  [operationResultTypeKey]: operationResultType.value,
  [operationStreamWrapperKey]({ ctx: { kvStore } } = {}) {
    return (source) => (async function* () {
      for await (const vertexId of source) {
        yield await kvStore.get(`node.${vertexId}.label`).then((data) => data.string())
      }
    })()
  },
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
  [operationStreamWrapperKey]({ ctx: { kvStore } } = {}) {
    return (source) => (async function* () {
      for await (const edgeId of source) {
        yield await kvStore.get(`edge.${edgeId}.label`).then((data) => data.string())
      }
    })()
  },
  [operationFactoryKey]({ parent: edgeId, ctx: { kvStore } } = {}) {
    async function* itr() {
      yield await kvStore.get(`edge.${edgeId}.label`).then((data) => data.string())
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}
