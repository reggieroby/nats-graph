import { VRef } from '../root/V.js'
import { operationFactoryKey, operationNameKey, operationName, operationResultType, operationResultTypeKey, Errors } from '../types.js'

export const edgeOutV = {
  [operationNameKey]: operationName.outV,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationFactoryKey]({ parent, ctx = {} } = {}) {
    const { kvStore: store, diagnostics } = ctx;
    const edgeId = parent == null ? null : String(parent)
    if (!edgeId) return VRef(null)

    diagnostics?.require(!!store, Errors.KVSTORE_MISSING, 'kvStore required in ctx for edgeOutV() traversal', { where: 'shelved/edgeOutV.factory' });

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
