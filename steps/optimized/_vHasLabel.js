import { operationResultTypeKey, operationFactoryKey, operationResultType, operationStreamWrapperKey } from '../types.js'
import { operationNameKey, operationName } from '../types.js'

export const _vHasLabel = {
  [operationResultTypeKey]: operationResultType.vertex,
  [operationNameKey]: operationName._vHasLabel,
  [operationStreamWrapperKey]({ ctx: { kvStore }, args: [v] } = {}) {
    return (_source) => (async function* () {
      for await (const key of await kvStore.keys(`node.*.label.${v}`)) {
        const [, id] = key.split('.')
        yield id
      }
    })()
  },
  [operationFactoryKey]({ ctx: { kvStore }, args: [v] } = {}) {
    async function* itr() {
      for await (const key of await kvStore.keys(`node.*.label.${v}`)) {
        const [, id] = key.split('.')
        yield id
      }
    }

    return {
      [Symbol.asyncIterator]: itr,
    }
  }
}
