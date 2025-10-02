import { assert } from '../../config.js'
import { operationResultTypeKey, operationFactoryKey, operationResultType, operationNameKey, operationName } from '../types.js'

export const limit = {
  [operationNameKey]: operationName.limit,
  [operationResultTypeKey]: operationResultType.vertex,
  [operationFactoryKey]() {
    assert(false, 'This is a placeholder that should never be called.')
  }
}
