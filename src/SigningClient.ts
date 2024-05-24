import { type Network } from './types/Network'
import axios from 'axios'
import { assertIsDeliverTxSuccess, type Coin, GasPrice } from '@cosmjs/stargate'
import { coin } from './util/Coin'
import { type Message } from './types/Message'
import { fromBase64, toBase64 } from '@cosmjs/encoding'
import { AuthInfo, Fee, TxBody, TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing'
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys'
import { makeSignDoc, type Registry } from '@cosmjs/proto-signing'
import { parseTxResult } from './util/TransactionHelper'
import { sleep } from './util/Sleep'
import { type Signer } from './Signers/Signer'
import { type DeliverTxResponse } from '@cosmjs/stargate/build/stargateclient'
import { isEmpty } from './util/TypeUtils'

const mathjs = require('mathjs')
const Long = require('long')

export class SigningClient {
  private readonly registry: Registry

  constructor (
    private readonly network: Network,
    private readonly defaultGasPrice: GasPrice,
    private readonly signer: Signer,
    private readonly defaultGasModifier: number = 1.5
  ) {
    this.registry = require('./Registry').registry.getProtoSigningRegistry()
  }

  async getAccount (address: string): Promise<any> {
    return await axios
      .get(this.network.restUrl + '/cosmos/auth/v1beta1/accounts/' + address)
      .then((res) => res.data.account)
      .then((value) => {
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
      .catch((error) => {
        if (error.response?.status === 404) {
          throw new Error('Account does not exist on chain')
        } else {
          throw error
        }
      })
  }

  async simulate (address: string, messages: Message[], memo?: string | undefined, modifier?: number | undefined, fee?: Fee | undefined): Promise<number> {
    const account = await this.getAccount(address)
    if (fee === undefined) { fee = this.getFee(100_000) }
    const txBody = {
      bodyBytes: this.makeBodyBytes(messages, memo),
      authInfoBytes: await this.makeAuthInfoBytes(account, fee, SignMode.SIGN_MODE_UNSPECIFIED),
      signatures: [new Uint8Array()]
    }

    try {
      const estimate = await axios.post(this.network.restUrl + '/cosmos/tx/v1beta1/simulate', {
        tx_bytes: toBase64(TxRaw.encode(txBody).finish())
      }).then(el => el.data.gas_info.gas_used)

      return parseInt((estimate * (modifier ?? this.defaultGasModifier)).toString())
    } catch (error: any) {
      if (error.response !== undefined && error.response.data !== undefined) {
        throw new Error(error.response.data.error as string)
      }

      throw new Error(error.message as string)
    }
  }

  async signAndBroadcast (address: string, messages: Message[], memo?: string, gasPrice?: GasPrice | string, gas?: number, fee?: Fee): Promise<DeliverTxResponse> {
    if (fee === undefined) {
      if (gas === undefined || gas === 0) { gas = await this.simulate(address, messages, memo) }
      fee = this.getFee(gas, gasPrice)
    }
    const txBody = await this.sign(address, messages, memo, fee)

    return await this.broadcast(txBody)
  }

  async sign (address: string, messages: Message[], memo: string | undefined = undefined, fee: Fee): Promise<TxRaw> {
    const account = await this.getAccount(address)
    const { account_number: accountNumber } = account
    const txBodyBytes = this.makeBodyBytes(messages, memo)
    // Sign using standard protobuf messages
    const authInfoBytes = await this.makeAuthInfoBytes(account, fee, SignMode.SIGN_MODE_DIRECT)
    const signDoc = makeSignDoc(txBodyBytes, authInfoBytes, this.network.chainId, Number(accountNumber))
    const { signature, signed } = await this.signer.signDirect(address, signDoc)

    return {
      bodyBytes: signed.bodyBytes,
      authInfoBytes: signed.authInfoBytes,
      signatures: [fromBase64(signature.signature as string)]
    }
  }

  async broadcast (txBody: TxRaw): Promise<DeliverTxResponse> {
    const timeoutMs = this.network.txTimeout !== 0 ? this.network.txTimeout : 60_000
    const pollIntervalMs = 3_000
    let timedOut = false
    const txPollTimeout = setTimeout(() => {
      timedOut = true
    }, timeoutMs)

    const pollForTx = async (txId: any): Promise<any> => {
      if (timedOut) {
        throw new Error(
                    `Transaction with ID ${txId} was submitted but was not yet found on the chain. You might want to check later. There was a wait of ${timeoutMs / 1000} seconds.`
        )
      }
      await sleep(pollIntervalMs)
      try {
        const response = await axios.get(this.network.restUrl + '/cosmos/tx/v1beta1/txs/' + txId)
        return parseTxResult(response.data.tx_response)
      } catch {
        return await pollForTx(txId)
      }
    }

    const response = await axios.post(this.network.restUrl + '/cosmos/tx/v1beta1/txs', {
      tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
      mode: 'BROADCAST_MODE_SYNC'
    })
    const result = parseTxResult(response.data.tx_response)
    assertIsDeliverTxSuccess(result)

    return await pollForTx(result.transactionHash).then(
      (value: DeliverTxResponse) => {
        clearTimeout(txPollTimeout)
        assertIsDeliverTxSuccess(value)
        return value
      },
      (error: any) => {
        clearTimeout(txPollTimeout)
        return error
      }
    )
  }

  // vendored to handle large integers
  // https://github.com/cosmos/cosmjs/blob/0f0c9d8a754cbf01e17acf51d3f2dbdeaae60757/packages/stargate/src/fee.ts
  calculateFee (gasLimit: number, gasPrice: GasPrice | string): { amount: Coin[], gas: bigint } {
    const processedGasPrice = typeof gasPrice === 'string' ? GasPrice.fromString(gasPrice) : gasPrice
    const { denom, amount: gasPriceAmount } = processedGasPrice
    const amount = mathjs.ceil(mathjs.bignumber(mathjs.multiply(mathjs.bignumber(gasPriceAmount.toString()), mathjs.bignumber(gasLimit.toString()))))
    return {
      amount: [coin(amount, denom)],
      gas: BigInt(gasLimit)
    }
  }

  getFee (gas: number, gasPrice?: GasPrice | string | undefined): Fee {
    if (gas === 0) {
      gas = 200000
    }

    const fee = this.calculateFee(gas, gasPrice ?? this.defaultGasPrice)

    return Fee.fromPartial({
      amount: fee.amount,
      gasLimit: fee.gas
    })
  }

  pubkeyTypeUrl (pubKey: undefined | { '@type': string }): string {
    if (pubKey !== undefined && pubKey['@type'].length > 0) {
      return pubKey['@type']
    }

    if (this.network.chain_name === 'injective') {
      return '/injective.crypto.v1beta1.ethsecp256k1.PubKey'
    }

    if (this.network.coinType === 60) {
      return '/ethermint.crypto.v1.ethsecp256k1.PubKey'
    }
    return '/cosmos.crypto.secp256k1.PubKey'
  }

  async makeAuthInfoBytes (account: any, fee: Fee, mode: any): Promise<Uint8Array> {
    const { sequence } = account
    const accountFromSigner = (await this.signer.getAccounts())[0]
    if (accountFromSigner === undefined) {
      throw new Error('Failed to retrieve account from signer')
    }
    const signerPubkey = accountFromSigner.pubkey
    return AuthInfo.encode({
      signerInfos: [
        {
          publicKey: {
            typeUrl: this.pubkeyTypeUrl(account.pub_key as undefined | { '@type': string }),
            value: PubKey.encode({
              key: signerPubkey
            }).finish()
          },
          sequence: Long.fromNumber(sequence, true),
          modeInfo: { single: { mode } }
        }
      ],
      fee
    }).finish()
  }

  makeBodyBytes (messages: Message[], memo: string | undefined = undefined): Uint8Array {
    const anyMsgs = messages.map((m) => this.registry.encodeAsAny(m))
    return TxBody.encode(
      TxBody.fromPartial({
        messages: anyMsgs,
        memo
      })
    ).finish()
  }
}
