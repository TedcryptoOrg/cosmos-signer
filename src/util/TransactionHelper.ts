import type { DeliverTxResponse } from '@cosmjs/stargate/build/stargateclient'

export function parseTxResult (result: any): DeliverTxResponse {
  return {
    code: result.code,
    height: result.height,
    rawLog: result.raw_log,
    transactionHash: result.txhash,
    gasUsed: result.gas_used,
    gasWanted: result.gas_wanted,
    events: [],
    txIndex: 0,
    msgResponses: []
  }
}
