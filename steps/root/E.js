import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName, operationStreamWrapperKey } from '../types.js'

export const E = {
  [operationNameKey]: operationName.E,
  [operationResultTypeKey]: operationResultType.edge,
  [operationStreamWrapperKey]({ ctx: { kvStore } = {}, args: [idOrIds] = [] } = {}) {
    return (_source) => (async function* () {
      if (Array.isArray(idOrIds)) {
        for (const edgeId of idOrIds) {
          const exists = await kvStore.get(`edges.${edgeId}`)
          if (exists) yield edgeId
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

      if (kvStore) {
        const exists = await kvStore.get(`edges.${idOrIds}`)
        if (exists) yield idOrIds
      }
    })()
  },
  [operationFactoryKey]({
    ctx: { kvStore } = {},
    args: [idOrIds] = [] } = {}
  ) {
    async function* iterator() {
      if (Array.isArray(idOrIds)) {
        for (const edgeId of idOrIds) {
          const exists = await kvStore.get(`edges.${edgeId}`)
          if (exists) yield edgeId
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

      if (kvStore) {
        const exists = await kvStore.get(`edges.${idOrIds}`)
        if (exists) yield idOrIds
      }
    }

    return {
      [Symbol.asyncIterator]: iterator,
    }
  }
}
