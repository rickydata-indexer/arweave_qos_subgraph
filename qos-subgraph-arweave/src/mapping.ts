import {
  json,
  JSONValue,
  JSONValueKind,
  log,
  Bytes,
  BigInt,
  BigDecimal,
  TypedMap
} from '@graphprotocol/graph-ts'
import { QoSDataPoint, IndexerStats, SubgraphDeployment } from '../generated/schema'

function convertToNumeric(value: JSONValue | null): BigDecimal {
  if (!value || value.kind != JSONValueKind.NUMBER) {
    return BigDecimal.fromString('0')
  }
  return BigDecimal.fromString(value.toString())
}

function convertToInteger(value: JSONValue | null): BigInt {
  if (!value || value.kind != JSONValueKind.NUMBER) {
    return BigInt.fromI32(0)
  }
  return BigInt.fromString(value.toString().split('.')[0])
}

function handleDataPoint(dataPoint: TypedMap<string, JSONValue>, index: string): void {
  // Use the ID from the data if available
  let idValue = dataPoint.get('id')
  let id = idValue && idValue.kind == JSONValueKind.STRING ? 
    idValue.toString() : 
    'qos-' + index

  log.debug('Processing data point with id: {}', [id])

  // Create new QoS data point
  let qosDataPoint = new QoSDataPoint(id)
  
  // Set timestamp
  let timestampValue = dataPoint.get('timestamp')
  if (timestampValue && timestampValue.kind == JSONValueKind.STRING) {
    qosDataPoint.timestamp = BigInt.fromI32(0)
  } else {
    qosDataPoint.timestamp = BigInt.fromI32(0)
  }

  // Handle subgraph deployment
  let deploymentHash = dataPoint.get('subgraph_deployment_ipfs_hash')
  if (!deploymentHash || deploymentHash.kind != JSONValueKind.STRING) {
    log.debug('Missing deployment hash for data point {}', [id])
    return
  }
  
  let deploymentId = deploymentHash.toString()
  let deployment = SubgraphDeployment.load(deploymentId)
  if (!deployment) {
    deployment = new SubgraphDeployment(deploymentId)
    deployment.save()
  }
  qosDataPoint.subgraphDeployment = deploymentId

  // Set all numeric fields with safe conversion
  qosDataPoint.avgIndexerBlocksBehind = convertToNumeric(dataPoint.get('avg_indexer_blocks_behind'))
  qosDataPoint.avgIndexerLatencyMs = convertToNumeric(dataPoint.get('avg_indexer_latency_ms'))
  qosDataPoint.maxIndexerBlocksBehind = convertToNumeric(dataPoint.get('max_indexer_blocks_behind'))
  qosDataPoint.maxIndexerLatencyMs = convertToNumeric(dataPoint.get('max_indexer_latency_ms'))
  qosDataPoint.numIndexer200Responses = convertToInteger(dataPoint.get('num_indexer_200_responses'))
  qosDataPoint.proportionIndexer200Responses = convertToNumeric(dataPoint.get('proportion_indexer_200_responses'))
  qosDataPoint.queryCount = convertToInteger(dataPoint.get('query_count'))
  qosDataPoint.stdevIndexerLatencyMs = convertToNumeric(dataPoint.get('stdev_indexer_latency_ms'))
  
  // Handle chain ID
  let chainId = dataPoint.get('chain_id')
  qosDataPoint.chainId = chainId && chainId.kind == JSONValueKind.STRING ? 
    chainId.toString() : 'unknown'
  
  // Handle end epoch
  let endEpoch = dataPoint.get('end_epoch')
  if (endEpoch && endEpoch.kind == JSONValueKind.STRING) {
    qosDataPoint.endEpoch = BigInt.fromString(endEpoch.toString())
  } else {
    qosDataPoint.endEpoch = BigInt.fromI32(0)
  }

  qosDataPoint.save()
  log.debug('Saved QoS data point with id {}', [id])
}

export function handleQoSData(content: Bytes): void {
  log.debug('======= START TRANSACTION HANDLER =======', [])
  
  // Log content details
  log.debug('Content length: {}', [content.length.toString()])
  
  if (content.length == 0) {
    log.error('Received empty content', [])
    return
  }

  // Log hex representation of first few bytes
  let hexContent = content.toHexString()
  let hexPrefix = hexContent.length > 20 ? hexContent.slice(0, 20) : hexContent
  log.debug('Content hex prefix: {}', [hexPrefix])

  // Try to get content as UTF8
  let contentString = content.toString()
  log.debug('Content string length: {}', [contentString.length.toString()])
  if (contentString.length > 0) {
    let strPrefix = contentString.length > 20 ? contentString.slice(0, 20) : contentString
    log.debug('Content string prefix: {}', [strPrefix])
  }

  // Try to parse JSON
  let jsonResult = json.try_fromBytes(content)
  if (jsonResult.isError) {
    log.error('JSON parsing failed for content', [])
    return
  }

  let value = jsonResult.value
  if (!value) {
    log.error('No JSON value present', [])
    return
  }

  log.debug('JSON value kind: {}', [value.kind.toString()])

  if (value.kind != JSONValueKind.ARRAY) {
    log.error('Expected JSON array, got kind: {}', [value.kind.toString()])
    return
  }

  let array = value.toArray()
  log.debug('Processing array of length {}', [array.length.toString()])

  for (let i = 0; i < array.length; i++) {
    if (!array[i] || array[i].kind != JSONValueKind.OBJECT) {
      log.debug('Skipping invalid array item at index {}', [i.toString()])
      continue
    }
    handleDataPoint(array[i].toObject(), i.toString())
  }

  log.debug('======= END TRANSACTION HANDLER =======', [])
}