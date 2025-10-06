import { uniqueID } from '../../config.js'
import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName, operationStreamWrapperKey } from '../types.js'

export const addV = {
  [operationNameKey]: operationName.addV,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationStreamWrapperKey]({ ctx: { kvStore, assertAndLog } = {}, args: [label] = [] } = {}) {
    return (_source) => (async function* () {
      assertAndLog(typeof label === 'string' && label.length, 'type required');

      const id = uniqueID();
      await Promise.all([
        kvStore.create(`node.${id}`, id),
        kvStore.create(`node.${id}.label`, label),
        kvStore.create(`node.${id}.label.${label}`, ""),
        kvStore.create(`nodes.${id}`, "")
      ]).catch(_err => {
        assertAndLog(false, `Failed to create node(${label}):${id}`);
      })
      yield id
    })()
  },
  [operationFactoryKey]({ ctx: { kvStore, assertAndLog } = {}, args: [label] = [] } = {}) {
    assertAndLog(typeof label === 'string' && label.length, 'type required');

    async function* itr() {
      const id = uniqueID();
      await Promise.all([
        kvStore.create(`node.${id}`, id),
        kvStore.create(`node.${id}.label`, label),
        kvStore.create(`node.${id}.label.${label}`, ""),
        kvStore.create(`nodes.${id}`, "")// Global vertex index for fast V() iteration
      ]).catch(_err => {
        assertAndLog(false, `Failed to create node(${label}):${id}`);
      })
      yield id
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}
