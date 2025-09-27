import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName } from '../types.js'

export const id = {
  [operationNameKey]: operationName.id,
  [operationResultTypeKey]: operationResultType.value,
  [operationFactoryKey]({ parent: id } = {}) {
    async function* itr() {
      yield id;
    }

    return {
      [Symbol.asyncIterator]: itr,
    };
  }
}