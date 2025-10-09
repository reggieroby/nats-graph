import { uniqueID } from '../../config.js'
import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName, operationStreamWrapperKey, Errors } from '../types.js'

export const addV = {
  [operationNameKey]: operationName.addV,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationStreamWrapperKey]({ ctx: { kvStore, diagnostics } = {}, args: [label] = [] } = {}) {
    return (_source) => (async function* () {
      diagnostics?.require(typeof label === 'string' && label.length, Errors.VERTEX_LABEL_REQUIRED, 'type required', { label });

      const id = uniqueID();
      await Promise.all([
        kvStore.create(`node.${id}`, id),
        kvStore.create(`node.${id}.label`, label),
        kvStore.create(`node.${id}.label.${label}`, ""),
        kvStore.create(`nodes.${id}`, "")
      ])
      yield id
    })()
  },
  [operationFactoryKey]({ ctx: { kvStore, diagnostics } = {}, args: [label] = [] } = {}) {
    diagnostics?.require(typeof label === 'string' && label.length, Errors.VERTEX_LABEL_REQUIRED, 'type required', { label });

    async function* itr() {
      const id = uniqueID();
      await Promise.all([
        kvStore.create(`node.${id}`, id),
        kvStore.create(`node.${id}.label`, label),
        kvStore.create(`node.${id}.label.${label}`, ""),
        kvStore.create(`nodes.${id}`, "")// Global vertex index for fast V() iteration
      ])
      yield id
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}
