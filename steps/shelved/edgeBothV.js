import { VRef } from '../root/V.js'
import { assert } from '../../config.js'
import { operationFactoryKey, operationNameKey, operationName, operationResultType, operationResultTypeKey } from '../types.js'

export const edgeBothV = {
  [operationNameKey]: operationName.bothV,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationFactoryKey]({ parent, ctx = {} } = {}) {
    const edgeId = parent == null ? null : String(parent)
    if (!edgeId) return VRef(null)

    const store = ctx?.kvStore;
    assert(store, 'kvStore required in ctx for edgeBothV() traversal');
    let incoming = null
    let outgoing = null

    return {
      [Symbol.asyncIterator]: (async function* () {
        try {
          incoming = await store.get(`edge.${edgeId}.incoming`).then((d) => d.string())
        } catch {
          incoming = null
        }

        try {
          outgoing = await store.get(`edge.${edgeId}.outgoing`).then((d) => d.string())
        } catch {
          outgoing = null
        }

        const ids = []
        if (incoming) ids.push(incoming)
        if (outgoing && outgoing !== incoming) ids.push(outgoing)

        if (ids.length === 0) return
        if (ids.length === 1) {
          if (ids[0] != null) yield ids[0]
          return
        }

        for (const id of ids) {
          if (id != null) yield id
        }
      })
    }
  }
}
