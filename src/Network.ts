import {type Chain, ChainDirectory, CosmosDirectory} from '@tedcryptoorg/cosmos-directory'
import {GasPrice} from "@cosmjs/stargate";
import BigNumber from 'bignumber.js';
import type {NetworkData} from "./types/NetworkData";

export class Network {
  constructor (public readonly data: NetworkData) {}

  public static async createFromChain (
      chain: Chain|string,
      txTimeout = 1000,
      restUrl: string | undefined = undefined,
      rpcUrl: string | undefined = undefined
  ): Promise<Network> {
    if(typeof chain === 'string'){
      chain = (await (new ChainDirectory().getChainData(chain))).chain
    }

    return new Network({
      ...chain,
      chain_name: chain.name,
      prettyName: chain.name,
      name: chain.name,
      authzAminoSupport: chain.params.authz,
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
    const feeConfig = chain.fees.fee_tokens?.find(el => el.denom === chain.denom)
    let gasPriceNumber = 0
    if(gasPrice){
      gasPriceNumber = Number(GasPrice.fromString(gasPrice).amount.toString())

      return {
        low: gasPriceNumber,
        average: feeConfig?.average_gas_price ?? gasPriceNumber,
        high: feeConfig?.high_gas_price ?? new BigNumber(gasPriceNumber).multipliedBy(2).toNumber(),
      }
    }

    const minimumGasPrice = feeConfig?.low_gas_price ?? feeConfig?.fixed_min_gas_price
    // @ts-ignore
    let defaultGasPrice = new BigNumber(0.000000025).multipliedBy(new BigNumber(10).pow(chain.decimals || 6)).toFixed(14);
    if (minimumGasPrice !== undefined && new BigNumber(minimumGasPrice).isGreaterThan(new BigNumber(defaultGasPrice))) {
      defaultGasPrice = String(minimumGasPrice)
    }
    gasPriceNumber = feeConfig?.average_gas_price ?? Number(defaultGasPrice)

    return {
      low: minimumGasPrice ?? new BigNumber(gasPriceNumber).multipliedBy(0.5).toNumber(),
      average: gasPriceNumber,
      high: feeConfig?.high_gas_price ?? new BigNumber(gasPriceNumber).multipliedBy(2).toNumber(),
    }
  }
}
