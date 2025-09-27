import { VRef } from '../root/V.js'
import { assert } from '../../config.js'
import { operationFactoryKey, operationNameKey, operationName, operationResultType, operationResultTypeKey } from '../types.js'

export const edgeOutV = {
  [operationNameKey]: operationName.outV,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationFactoryKey]({ parent, ctx = {} } = {}) {
    const edgeId = parent == null ? null : String(parent)
    if (!edgeId) return VRef(null)

    const store = ctx?.graphBucket;
    assert(store, 'graphBucket required in ctx for edgeOutV() traversal');

    return {
      [Symbol.asyncIterator]: (async function* () {
        let toId = null
        try {
          toId = await store.get(`edge.${edgeId}.outgoing`).then((d) => d.string())
        } catch {
          toId = null
        }
        if (toId != null) yield toId
      })
    }
  }
}
