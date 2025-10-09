import { operationResultTypeKey, operationFactoryKey, operationResultType as sharedElementType, operationNameKey, operationName, Errors } from '../types.js'

const normalizeLabels = (args) => {
  if (!Array.isArray(args)) return []
  return args
    .filter((label) => label != null && label !== '')
    .map((label) => String(label))
}

export const inStep = {
  [operationNameKey]: operationName.in,
  [operationResultTypeKey]: sharedElementType.vertex,
  [operationFactoryKey]({ parent, ctx = {}, args = [] } = {}) {
    const { kvStore: store, diagnostics } = ctx;
    diagnostics?.invariant(false, Errors.NOT_IMPLEMENTED, "Please update this function to steps folder", { step: 'shelved/in' })
    const vertexId = parent == null ? null : String(parent)
    if (!vertexId) {
      async function* empty() { }
      return { [Symbol.asyncIterator]: empty }
    }

    const wanted = new Set(normalizeLabels(args))

    async function* iterator() {
      diagnostics?.require(!!store, Errors.KVSTORE_MISSING, 'kvStore required in ctx for in() traversal', { where: 'shelved/in.iterator' });
      const seen = new Set()
      try {
        if (wanted.size > 0) {
          for (const label of wanted) {
            const keys = await store.keys(`node.${vertexId}.inV.${label}.*`)
            for await (const key of keys) {
              const fromId = key.split('.').pop()
              if (!fromId || seen.has(fromId)) continue
              seen.add(fromId)
              yield fromId
            }
          }
        } else {
          const keys = await store.keys(`node.${vertexId}.inV.*`)
          for await (const key of keys) {
            const fromId = key.split('.').pop()
            if (!fromId || seen.has(fromId)) continue
            seen.add(fromId)
            yield fromId
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
