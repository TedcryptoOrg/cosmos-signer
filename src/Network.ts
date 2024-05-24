import { type Network as NetworkData } from './types/Network'
import { type Chain, CosmosDirectory } from '@tedcryptoorg/cosmos-directory'

export class Network {
  constructor (public readonly data: NetworkData) {}

  public static createFromChain (chain: Chain, txTimeout: number = 1000, restUrl: string | undefined = undefined): Network {
    return new Network({
      chain_name: chain.name,
      authzAminoSupport: chain.params.authz ?? false,
      prefix: chain.bech32_prefix,
      txTimeout,
      coinType: chain.slip44,
      chainId: chain.chain_id,
      restUrl: restUrl ?? new CosmosDirectory().restUrl(chain.name)
    })
  }
}
