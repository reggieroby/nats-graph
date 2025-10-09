import { operationResultTypeKey, operationFactoryKey, operationResultType as sharedElementType, operationNameKey, operationName, Errors } from '../types.js'

const normalizeLabels = (args) => {
  if (!Array.isArray(args)) return []
  return args
    .filter((label) => label != null && label !== '')
    .map((label) => String(label))
}

export const out = {
  [operationNameKey]: operationName.out,
  [operationResultTypeKey]: sharedElementType.vertex,
  [operationFactoryKey]({ parent, ctx = {}, args = [] } = {}) {
    const { kvStore: store, diagnostics } = ctx;
    diagnostics?.invariant(false, Errors.NOT_IMPLEMENTED, "Please update this function to steps folder", { step: 'shelved/out' })
    const vertexId = parent == null ? null : String(parent)
    if (!vertexId) {
      async function* empty() { }
      return { [Symbol.asyncIterator]: empty }
    }

    const wanted = new Set(normalizeLabels(args))

    async function* iterator() {
      diagnostics?.require(!!store, Errors.KVSTORE_MISSING, 'kvStore required in ctx for out() traversal', { where: 'shelved/out.iterator' });
      const seen = new Set()
      try {
        if (wanted.size > 0) {
          for (const label of wanted) {
            const keys = await store.keys(`node.${vertexId}.outV.${label}.*`)
            for await (const key of keys) {
              const toId = key.split('.').pop()
              if (!toId || seen.has(toId)) continue
              seen.add(toId)
              yield toId
            }
          }
        } else {
          const keys = await store.keys(`node.${vertexId}.outV.*`)
          for await (const key of keys) {
            const toId = key.split('.').pop()
            if (!toId || seen.has(toId)) continue
            seen.add(toId)
            yield toId
          }
        }
      } catch {
        /* ignore traversal errors */
      }
    }

    return {
      [Symbol.asyncIterator]: iterator
    }
  }
}
