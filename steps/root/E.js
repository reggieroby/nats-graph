import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName } from '../types.js'

export const E = {
  [operationNameKey]: operationName.E,
  [operationResultTypeKey]: operationResultType.edge,
  [operationFactoryKey]({ ctx: { kvStore } = {}, args: [idOrIds] } = {}) {
    async function* iterator() {
      if (Array.isArray(idOrIds)) {
        for (const edgeId of idOrIds) {
          yield edgeId
        }
        return
      }

      if (idOrIds === undefined || idOrIds === null) {
        const keys = await kvStore.keys('edges.*')
        for await (const key of keys) {
          yield key.split('.').pop()
        }
        return
      }

      yield idOrIds
    }

    return {
      [Symbol.asyncIterator]: iterator,
    }
  }
}
