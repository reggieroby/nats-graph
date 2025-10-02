import { assert, uniqueID } from '../../config.js'
import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName } from '../types.js'

export const addV = {
  [operationNameKey]: operationName.addV,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationFactoryKey]({ ctx: { kvStore }, args: [label] } = {}) {
    assert(typeof label === 'string' && label.length, 'type required');

    async function* itr() {
      const id = uniqueID();
      await Promise.all([
        kvStore.create(`node.${id}`, id),
        kvStore.create(`node.${id}.label`, label),
        kvStore.create(`node.${id}.label.${label}`, ""),
        kvStore.create(`nodes.${id}`, "")// Global vertex index for fast V() iteration
      ]).catch(_err => {
        assert(false, `Failed to create node(${label}):${id}`);
      })
      yield id
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}
