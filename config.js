import nodeAssert from 'node:assert'
import { connection } from "./natsConnection.js";
import { ulid } from 'ulid'

export const assert = nodeAssert
export {
  ulid,
  connection,
}