import nodeAssert from 'node:assert'
import { ulid } from 'ulid'


export const assertAndLog = (v, message, context) => {
  try {
    nodeAssert(v, message)
  } catch (err) {
    // logger.fatal(message, { err, v, context })
    nodeAssert(v, message)
  }
}
export {
  ulid as uniqueID,
}