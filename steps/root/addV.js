import { assert, ulid } from '../../config.js'
import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName } from '../types.js'

export const addV = {
  [operationNameKey]: operationName.addV,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationFactoryKey]({ ctx: { graphBucket }, args: [label] } = {}) {
    assert(typeof label === 'string' && label.length, 'type required');

    async function* itr() {
      const id = ulid();
      await Promise.all([
        graphBucket.create(`node.${id}`, id),
        graphBucket.create(`node.${id}.label`, label),
        graphBucket.create(`node.${id}.label.${label}`, ""),
        graphBucket.create(`nodes.${id}`, "")// Global vertex index for fast V() iteration
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
