import { type NetworkData } from './types'
import { type Chain, CosmosDirectory } from '@tedcryptoorg/cosmos-directory'
import {bignumber, format, larger, multiply, number, pow} from "mathjs";
import {GasPrice} from "@cosmjs/stargate";

export class Network {
  constructor (public readonly data: NetworkData) {}

  public static createFromChain (
      chain: Chain,
      txTimeout: number = 1000,
      restUrl: string | undefined = undefined,
      rpcUrl: string | undefined = undefined
  ): Network {
    return new Network({
      ...chain,
      chain_name: chain.name,
      prettyName: chain.name,
      name: chain.name,
      authzAminoSupport: chain.params.authz ?? false,
      prefix: chain.bech32_prefix,
      txTimeout,
      coinType: chain.slip44,
      chainId: chain.chain_id,
      rpcUrl: rpcUrl ?? new CosmosDirectory().rpcUrl(chain.name),
      restUrl: restUrl ?? new CosmosDirectory().restUrl(chain.name),
      gasPriceStep: this.getGasPriceStep(chain),
      decimals: chain.decimals,
      coinGeckoId: chain.coingecko_id,
      authzAminoGenericOnly: true,
      aminoPreventTypes: [],
      authzAminoExecPreventTypes: [],
      authzAminoLiftedValues: true,
      data: {} // @todo: figure this out
    })
  }

  private static getGasPriceStep(chain: Chain, gasPrice?: string): {high: number, average: number, low: number} {
    const feeConfig = chain.fees?.fee_tokens?.find(el => el.denom === chain.denom)

    let gasPriceNumber: number
    if(gasPrice){
      gasPriceNumber = number(GasPrice.fromString(gasPrice).amount.toString())

      return {
        low: gasPriceNumber,
        average: feeConfig?.average_gas_price ?? gasPriceNumber,
        high: feeConfig?.high_gas_price ?? multiply(gasPriceNumber, 2),
      }
    }

    const minimumGasPrice = feeConfig?.low_gas_price ?? feeConfig?.fixed_min_gas_price
    // @ts-ignore
    let defaultGasPrice = number(format(bignumber(multiply(0.000000025, pow(10, chain.decimals || 6))), { precision: 14 }))
    if(minimumGasPrice != undefined && larger(minimumGasPrice, defaultGasPrice)){
      defaultGasPrice = minimumGasPrice
    }
    gasPriceNumber = feeConfig?.average_gas_price ?? defaultGasPrice

    return {
      low: minimumGasPrice ?? multiply(gasPriceNumber, 0.5),
      average: gasPriceNumber,
      high: feeConfig?.high_gas_price ?? multiply(gasPriceNumber, 2),
    }
  }
}
