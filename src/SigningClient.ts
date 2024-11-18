import type { NetworkData, Message } from './types'
import axios from 'axios'
import { assertIsDeliverTxSuccess, type Coin, GasPrice } from '@cosmjs/stargate'
import { toBase64 } from '@cosmjs/encoding'
import { Fee, TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { parseTxResult, sleep, isEmpty, coin } from './util'
import type { DefaultSigner } from './Signers'
import type { DeliverTxResponse } from '@cosmjs/stargate/build/stargateclient'
import * as mathjs from 'mathjs'
import _ from "lodash";
import type {Wallet} from "./Wallet";

export class SigningClient {
  constructor (
    private readonly network: NetworkData,
    private readonly defaultGasPrice: GasPrice,
    private readonly signer: DefaultSigner,
    private readonly wallet: Wallet,
    private readonly defaultGasModifier = 1.5
  ) {
  }

  async getAccount (address: string): Promise<any> {
    return await axios
      .get(this.network.restUrl + '/cosmos/auth/v1beta1/accounts/' + address)
      .then((res) => res.data.account)
      .then((value) => {
        if(!value) throw new Error('Failed to fetch account, please try again')

        // see https://github.com/chainapsis/keplr-wallet/blob/7ca025d32db7873b7a870e69a4a42b525e379132/packages/cosmos/src/account/index.ts#L73
        // If the chain modifies the account type, handle the case where the account type embeds the base account.
        // (Actually, the only existent case is ethermint, and this is the line for handling ethermint)
        const baseAccount = 'BaseAccount' in value
          ? value.BaseAccount
          : ('baseAccount' in value ? value.baseAccount : value.base_account)
        if (!isEmpty(baseAccount)) {
          value = baseAccount
        }

        // If the account is the vesting account that embeds the base vesting account,
        // the actual base account exists under the base vesting account.
        // But, this can be different according to the version of cosmos-sdk.
        // So, anyway, try to parse it by some ways...
        const baseVestingAccount = 'BaseVestingAccount' in value
          ? value.BaseVestingAccount
          : ('baseVestingAccount' in value ? value.baseVestingAccount : value.base_vesting_account)
        if (!isEmpty(baseVestingAccount)) {
          value = baseVestingAccount

          const baseAccount = 'BaseAccount' in value
            ? value.BaseAccount
            : ('baseAccount' in value ? value.baseAccount : value.base_account)
          if (!isEmpty(baseAccount)) {
            value = baseAccount
          }
        }

        // Handle nested account like Desmos
        const nestedAccount = value.account
        if (!isEmpty(nestedAccount)) {
          value = nestedAccount
        }

        return value
      })
      .catch((error: any) => {
        if (error.response?.status === 404) {
          throw new Error('Account does not exist on chain')
        } else {
          throw new Error('Unknown error when getting account')
        }
      })
  }

  // vendored to handle large integers
  // https://github.com/cosmos/cosmjs/blob/0f0c9d8a754cbf01e17acf51d3f2dbdeaae60757/packages/stargate/src/fee.ts
  calculateFee (gasLimit: number, gasPrice: GasPrice | string): { amount: Coin[], gas: bigint } {
    const processedGasPrice = typeof gasPrice === 'string' ? GasPrice.fromString(gasPrice) : gasPrice
    const { denom, amount: gasPriceAmount } = processedGasPrice
    const amount = mathjs.ceil(mathjs.bignumber(
        // @ts-ignore
        mathjs.multiply(
            mathjs.bignumber(gasPriceAmount.toString()),
            mathjs.bignumber(gasLimit.toString())
        )
    ))

    return {
      amount: [coin(amount, denom)],
      gas: BigInt(gasLimit)
    }
  }

  getFee(gas?: number, gasPrice?: GasPrice | string  ): Fee {
    if (gas === undefined || gas === 0) {
      gas = 200000
    }

    const fee = this.calculateFee(gas, gasPrice ?? this.defaultGasPrice)

    return Fee.fromPartial({
      amount: fee.amount,
      gasLimit: fee.gas
    })
  }

  async signAndBroadcastWithoutBalanceCheck(address: string, msgs: Message[], gas?: number, memo?: string, gasPrice?: GasPrice | string  ) {
    const defaultOptions = _.cloneDeep(this.wallet.getOptions())
    this.wallet.setOptions({ sign: { disableBalanceCheck: true } })
    try {
      return await this.signAndBroadcast(address, msgs, gas, memo, gasPrice)
    } finally {
      this.wallet.setOptions(defaultOptions)
    }
  }

  async signAndBroadcast(address: string, messages: Message[], gas?: number, memo?: string, gasPrice?: GasPrice | string  ) {
    if (!gas)
      {gas = await this.simulate(address, messages, memo);}
    const fee = this.getFee(gas, gasPrice);
    const txBody = await this.sign(address, messages, fee, memo)

    return await this.broadcast(txBody)
  }

  async sign(address: string, messages: Message[], fee: Fee, memo?: string) {
    const account = await this.getAccount(address)

    return await this.signer.sign(account, messages, fee, memo)
  }

  async simulate(address: string, messages: Message[], memo?: string, modifier?: number) {
    const account = await this.getAccount(address)
    const fee = this.getFee(100_000)
    const txBody = await this.signer.simulate(account, messages, fee, memo)
    try {
      const estimate = await axios.post(this.network.restUrl + '/cosmos/tx/v1beta1/simulate', {
        tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
      }).then(el => el.data.gas_info.gas_used)
      // @ts-ignore
      return (parseInt(estimate * (modifier ?? this.defaultGasModifier)));
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  async broadcast (txBody: TxRaw): Promise<DeliverTxResponse> {
    const timeoutMs = this.network.txTimeout !== 0 ? this.network.txTimeout : 60_000
    const pollIntervalMs = 3_000
    let timedOut = false
    const txPollTimeout = setTimeout(() => {
      timedOut = true;
    }, timeoutMs);

    const pollForTx = async (txId: any): Promise<any> => {
      if (timedOut) {
        throw new Error(
            `Transaction with ID ${txId} was submitted but was not yet found on the chain. You might want to check later. There was a wait of ${timeoutMs / 1000} seconds.`
        );
      }
      await sleep(pollIntervalMs);
      try {
        const response = await axios.get(this.network.restUrl + '/cosmos/tx/v1beta1/txs/' + txId);

        return parseTxResult(response.data.tx_response)
      } catch {
        return await pollForTx(txId);
      }
    };

    const response = await axios.post(this.network.restUrl + '/cosmos/tx/v1beta1/txs', {
      tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
      mode: "BROADCAST_MODE_SYNC"
    })
    const result = parseTxResult(response.data.tx_response)
    assertIsDeliverTxSuccess(result)
    return await pollForTx(result.transactionHash).then(
        (value) => {
          clearTimeout(txPollTimeout);
          assertIsDeliverTxSuccess(value)
          return value
        },
        (error) => {
          clearTimeout(txPollTimeout);
          return error
        },
    )
  }

  parseTxResult(result: any){
    return {
      code: result.code,
      height: result.height,
      rawLog: result.raw_log,
      transactionHash: result.txhash,
      gasUsed: result.gas_used,
      gasWanted: result.gas_wanted,
    }
  }
}
