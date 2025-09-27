import { V } from './root/V.js'
import { addV } from './root/addV.js'
import { E } from './root/E.js'
import { addE } from './root/addE.js'
import { _vHasLabel } from './optimized/_vHasLabel.js'
import { dropEdge, dropGraph, dropVertex } from "./terminal/drop.js";
import { operationName, operationResultType } from './types.js'
import { edgeHas, vertexHas } from './filter/has.js'
import { edgeLimit, valueLimit, vertexLimit } from './filter/limit.js'
import { edgePropertyStep, vertexPropertyStep } from './mutation/property.js'
import { bothE } from './shelved/bothE.js'
import { inStep } from './shelved/in.js'
import { inE } from './shelved/inE.js'
import { out } from './VtoV/out.js'
import { outE } from './shelved/outE.js'
import { id } from './terminal/id.js'
import { edgeLabel, vertexLabel } from './terminal/label.js'
import { edgeProperties, vertexProperties } from './shelved/properties.js'
import { edgeValueMap, vertexValueMap } from './terminal/valueMap.js'
import { edgeBothV } from './shelved/edgeBothV.js'
import { edgeInV } from './shelved/edgeInV.js'
import { edgeOtherV } from './shelved/edgeOtherV.js'
import { edgeOutV } from './shelved/edgeOutV.js'
import { count } from './terminal/count.js'




export const operationsMap = new Map([
  [operationName.V, V],
  [operationName.addV, addV],
  [operationName.E, E],
  [operationName.addE, addE],
  [operationName._vHasLabel, _vHasLabel],
  [operationName.property, vertexPropertyStep],
  [operationName.has, vertexHas],
  [operationName.out, out],
  [operationName.in, inStep],
  [operationName.outE, outE],
  [operationName.inE, inE],
  [operationName.bothE, bothE],
  [operationName.drop, dropVertex],
  [operationName.id, id],
  [operationName.label, vertexLabel],
  [operationName.properties, vertexProperties],
  [operationName.valueMap, vertexValueMap],
  [operationName.limit, vertexLimit],
  [operationName.property, edgePropertyStep],
  [operationName.outV, edgeOutV],
  [operationName.inV, edgeInV],
  [operationName.bothV, edgeBothV],
  [operationName.otherV, edgeOtherV],
  [operationName.drop, dropEdge],
  [operationName.label, edgeLabel],
  [operationName.properties, edgeProperties],
  [operationName.valueMap, edgeValueMap]
])


export const nextAvailableOperationsMap = new Map([
  [
    operationResultType.graph,
    new Map([
      ['V', V],
      ['addV', addV],
      ['E', E],
      ['addE', addE],
      ['drop', dropGraph],
      ['_vHasLabel', _vHasLabel]
    ]),
  ], [
    operationResultType.vertex,
    new Map([
      ['property', vertexPropertyStep],
      ['has', vertexHas],
      ['out', out],
      ['in', inStep],
      ['outE', outE],
      ['inE', inE],
      ['bothE', bothE],
      ['drop', dropVertex],
      ['id', id],
      ['label', vertexLabel],
      ['properties', vertexProperties],
      ['valueMap', vertexValueMap],
      ['limit', vertexLimit],
      ['count', count],
    ]),
  ], [
    operationResultType.edge,
    new Map([
      ['property', edgePropertyStep],
      ['has', edgeHas],
      ['drop', dropEdge],
      ['label', edgeLabel],
      ['id', id],
      ['properties', edgeProperties],
      ['valueMap', edgeValueMap],
      ['outV', edgeOutV],
      ['inV', edgeInV],
      ['bothV', edgeBothV],
      ['otherV', edgeOtherV],
      ['limit', edgeLimit],
      ['count', count],
    ]),
  ], [
    operationResultType.value,
    new Map([
      ['limit', valueLimit],
      ['count', count],
    ])
  ]
])

