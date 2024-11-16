import {
  json,
  JSONValue,
  JSONValueKind,
  log,
  Bytes,
  BigInt
} from '@graphprotocol/graph-ts'
import { QoSDataPoint, DebugLog } from '../generated/schema'

function createDebugLog(message: string, step: string, data: string): void {
  let id = step + '-' + data.length.toString()
  let debug = new DebugLog(id)
  debug.message = message
  debug.step = step
  debug.data = data
  debug.timestamp = BigInt.fromI32(0)
  debug.save()
}

export function handleQoSData(content: Bytes): void {
  // Create initial debug log
  createDebugLog(
    'Handler started', 
    'start', 
    'content length: ' + content.length.toString()
  )

  // Create a test entity to verify basic entity creation
  let debugId = 'debug-' + content.length.toString()
  let debugEntity = new QoSDataPoint(debugId)
  debugEntity.timestamp = BigInt.fromI32(1234567)
  debugEntity.subgraphDeployment = 'test-deployment'
  debugEntity.avgIndexerBlocksBehind = BigInt.fromI32(42)
  debugEntity.avgIndexerLatencyMs = BigInt.fromI32(100)
  debugEntity.maxIndexerBlocksBehind = BigInt.fromI32(50)
  debugEntity.maxIndexerLatencyMs = BigInt.fromI32(200)
  debugEntity.numIndexer200Responses = BigInt.fromI32(10)
  debugEntity.proportionIndexer200Responses = BigInt.fromI32(1)
  debugEntity.queryCount = BigInt.fromI32(20)
  debugEntity.stdevIndexerLatencyMs = BigInt.fromI32(5)
  debugEntity.chainId = 'debug-chain'
  debugEntity.endEpoch = BigInt.fromI32(9876543)
  debugEntity.save()

  createDebugLog(
    'Created debug entity', 
    'debug-entity', 
    debugId
  )

  // Check content
  if (content.length == 0) {
    createDebugLog(
      'Empty content received', 
      'content-check', 
      'length: 0'
    )
    return
  }

  // Try to parse JSON
  let jsonResult = json.try_fromBytes(content)
  if (jsonResult.isError) {
    createDebugLog(
      'JSON parse failed', 
      'json-parse', 
      'error'
    )
    return
  }

  let contentString = content.toString()
  createDebugLog(
    'Content as string', 
    'content-string', 
    contentString.slice(0, 100) // Take first 100 chars for debug
  )

  let value = jsonResult.value
  createDebugLog(
    'JSON kind', 
    'json-kind', 
    value.kind.toString()
  )

  if (value.kind != JSONValueKind.ARRAY) {
    createDebugLog(
      'Not an array', 
      'type-check', 
      value.kind.toString()
    )
    return
  }

  let array = value.toArray()
  createDebugLog(
    'Array length', 
    'array-length', 
    array.length.toString()
  )

  for (let i = 0; i < array.length; i++) {
    if (!array[i] || array[i].kind != JSONValueKind.OBJECT) {
      continue
    }

    let dataPoint = array[i].toObject()
    let id = dataPoint.get('id')
    if (!id || id.kind != JSONValueKind.STRING) {
      continue
    }

    let entityId = id.toString()
    createDebugLog(
      'Processing data point', 
      'data-point', 
      entityId
    )

    // Create entity with real data
    let entity = new QoSDataPoint(entityId)
    
    // Set required fields with safe fallbacks
    entity.timestamp = BigInt.fromI32(0)
    entity.subgraphDeployment = dataPoint.get('subgraph_deployment_ipfs_hash') ? 
      dataPoint.get('subgraph_deployment_ipfs_hash')!.toString() : 
      'unknown'
    
    // Handle numeric fields
    entity.avgIndexerBlocksBehind = BigInt.fromI32(0)
    entity.avgIndexerLatencyMs = BigInt.fromI32(0)
    entity.maxIndexerBlocksBehind = BigInt.fromI32(0)
    entity.maxIndexerLatencyMs = BigInt.fromI32(0)
    entity.numIndexer200Responses = BigInt.fromI32(0)
    entity.proportionIndexer200Responses = BigInt.fromI32(0)
    entity.queryCount = BigInt.fromI32(0)
    entity.stdevIndexerLatencyMs = BigInt.fromI32(0)
    
    // Handle string fields
    entity.chainId = dataPoint.get('chain_id') ? 
      dataPoint.get('chain_id')!.toString() : 
      'unknown'
    
    entity.endEpoch = BigInt.fromI32(0)

    entity.save()
    createDebugLog(
      'Saved entity', 
      'save', 
      entityId
    )
  }

  createDebugLog(
    'Handler completed', 
    'end', 
    'content length: ' + content.length.toString()
  )
}