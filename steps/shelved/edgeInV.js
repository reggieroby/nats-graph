import { VRef } from '../root/V.js'
import { assert } from '../../config.js'
import { operationFactoryKey, operationNameKey, operationName, operationResultType, operationResultTypeKey } from '../types.js'

export const edgeInV = {
  [operationNameKey]: operationName.inV,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationFactoryKey]({ parent, ctx = {} } = {}) {
    const edgeId = parent == null ? null : String(parent)
    if (!edgeId) return VRef(null)

    const store = ctx?.kvStore;
    assert(store, 'kvStore required in ctx for edgeInV() traversal');

    return {
      [Symbol.asyncIterator]: (async function* () {
        let fromId = null
        try {
          fromId = await store.get(`edge.${edgeId}.incoming`).then((d) => d.string())
        } catch {
          fromId = null
        }
        if (fromId != null) yield fromId
      })
    }
  }
}
