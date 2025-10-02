import { assert } from '../../config.js'
import { operationResultTypeKey, operationFactoryKey, operationResultType as sharedElementType, operationNameKey, operationName } from '../types.js'

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
    assert(false, "Please update this function to steps folder")
    const vertexId = parent == null ? null : String(parent)
    if (!vertexId) {
      async function* empty() { }
      return { [Symbol.asyncIterator]: empty }
    }

    const wanted = new Set(normalizeLabels(args))

    async function* iterator() {
      const store = ctx?.kvStore;
      assert(store, 'kvStore required in ctx for in() traversal');
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
