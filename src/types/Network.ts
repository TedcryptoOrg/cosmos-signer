export interface Network {
  chain_name: string
  authzAminoSupport: boolean
  prefix: string
  txTimeout: number
  coinType: number
  chainId: string
  restUrl: string
}
