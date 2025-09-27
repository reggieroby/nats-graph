import {
  operationResultTypeKey,
  operationStreamWrapperKey,
  operationResultType,
  operationNameKey,
  operationName,
} from '../types.js'

export const count = {
  [operationNameKey]: operationName.count,
  [operationResultTypeKey]: operationResultType.value,
  [operationStreamWrapperKey]() {
    // count() takes no arguments; ignore any that are passed
    return (source) => (async function* () {
      let total = 0
      for await (const _ of source) total += 1
      yield total
    })()
  }
}
