import { assert } from '../../config.js'
import { operationFactoryKey, operationNameKey, operationName, operationResultType, operationResultTypeKey } from '../types.js'

const normalizeLabels = (args) => {
  if (!Array.isArray(args)) return []
  return args
    .filter((label) => label != null && label !== '')
    .map((label) => String(label))
}

const parseIndexArray = async (store, key) => {
  try {
    const data = await store.get(key).then((d) => d.string()).catch(() => '[]')
    const parsed = JSON.parse(data || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const outE = {
  [operationNameKey]: operationName.outE,
  [operationResultTypeKey]: operationResultType.edge,
  [operationFactoryKey]({ parent, ctx = {}, args = [] } = {}) {
    const vertexId = parent == null ? null : String(parent)
    if (!vertexId) {
      async function* empty() { }
      return { [Symbol.asyncIterator]: empty }
    }

    const wanted = new Set(normalizeLabels(args))
    const store = ctx?.graphBucket;
    assert(store, 'graphBucket required in ctx for outE() traversal');
    const edgeIds = new Set()

    const addFromIndex = async (key) => {
      const values = await parseIndexArray(store, key)
      for (const value of values) {
        const edgeId = value == null ? null : String(value)
        if (edgeId) edgeIds.add(edgeId)
      }
    }

    return {
      [Symbol.asyncIterator]: (async function* () {
        if (wanted.size > 0) {
          for (const label of wanted) {
            await addFromIndex(`node.${vertexId}.outE.${label}.__index`)
          }
        } else {
          await addFromIndex(`node.${vertexId}.outE.__index`)
        }

        const ids = Array.from(edgeIds)
        for (const id of ids) {
          if (id != null) yield id
        }
      })
    }
  }
}
