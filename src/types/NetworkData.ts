export interface NetworkData {
  chain_name: string
  path: string
  name: string
  prettyName: string
  authzAminoSupport: boolean
  authzAminoGenericOnly: boolean
  authzAminoExecPreventTypes: string[]
  aminoPreventTypes: string[]
  authzAminoLiftedValues: boolean
  prefix: string
  txTimeout: number
  coinType: number
  chainId: string
  rpcUrl: string
  restUrl: string
  slip44: string|number
  symbol: string
  denom: string
  gasPriceStep: {
    high: number
    average: number
    low: number
  }
  decimals: number
  coinGeckoId?: string
  data: {
    keplrFeatures?: string[]
  }
}
