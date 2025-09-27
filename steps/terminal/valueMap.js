import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName } from '../types.js'

export const vertexValueMap = {
  [operationNameKey]: operationName.valueMap,
  [operationResultTypeKey]: operationResultType.value,
  [operationFactoryKey]({ parent: vertexId, ctx: { graphBucket } } = {}) {
    async function* iterator() {
      const keys = await graphBucket.keys(`node.${vertexId}.property.*`).then(Array.fromAsync)

      yield await Promise.all(
        keys.map(key => graphBucket
          .get(key)
          .then(d => d.json())
          .then(v => [key.split('.').pop(), v])
          .catch((err) => {
            console.log({ err })
            return [k, undefined]
          })
        )
      )
        .then(kvEntriesArray => Object.fromEntries(kvEntriesArray));

    }

    return {
      [Symbol.asyncIterator]: iterator
    };
  }
}

export const edgeValueMap = {
  [operationNameKey]: operationName.valueMap,
  [operationResultTypeKey]: operationResultType.value,
  [operationFactoryKey]({ parent: edgeId, ctx: { graphBucket } } = {}) {
    async function* iterator() {
      const keys = await graphBucket.keys(`edge.${edgeId}.property.*`).then(Array.fromAsync)
      yield await Promise.all(
        keys.map(key => graphBucket
          .get(key)
          .then(d => d.json())
          .then(v => [key.split('.').pop(), v])
          .catch((err) => {
            console.log({ err })
            return [k, undefined]
          })
        )
      )
        .then(kvEntriesArray => Object.fromEntries(kvEntriesArray));
    }

    return {
      [Symbol.asyncIterator]: iterator
    };
  }
}
