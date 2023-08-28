import {Network} from "./types/Network";
import axios from "axios";
import {assertIsDeliverTxSuccess, GasPrice} from "@cosmjs/stargate";
import {coin} from "./util/Coin";
import {Message} from "./types/Message";
import {fromBase64, toBase64} from "@cosmjs/encoding";
import {AuthInfo, Fee, TxBody, TxRaw} from "cosmjs-types/cosmos/tx/v1beta1/tx";
import {SignMode} from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import {PubKey} from "cosmjs-types/cosmos/crypto/secp256k1/keys";
import { makeSignDoc, Registry } from "@cosmjs/proto-signing";
import {parseTxResult} from "./util/TransactionHelper";
import {sleep} from "./util/Sleep";
import {Signer} from "./Signers/Signer";
import { type DeliverTxResponse } from '@cosmjs/stargate/build/stargateclient'

const mathjs = require('mathjs');
const Long = require('long');

export class SigningClient {
    private registry: Registry;

    constructor(
        private readonly network: Network,
        private readonly defaultGasPrice: GasPrice,
        private readonly signer: Signer,
        private defaultGasModifier: number = 1.5
    ) {
        this.registry = require('./Registry').registry.getProtoSigningRegistry();
    }

    async getAccount(address: string) {
        return axios
            .get(this.network.restUrl + "/cosmos/auth/v1beta1/accounts/" + address)
            .then((res) => res.data.account)
            .then((value) => {
                // see https://github.com/chainapsis/keplr-wallet/blob/7ca025d32db7873b7a870e69a4a42b525e379132/packages/cosmos/src/account/index.ts#L73
                // If the chain modifies the account type, handle the case where the account type embeds the base account.
                // (Actually, the only existent case is ethermint, and this is the line for handling ethermint)
                const baseAccount =
                    value.BaseAccount || value.baseAccount || value.base_account;
                if (baseAccount) {
                    value = baseAccount;
                }

                // If the account is the vesting account that embeds the base vesting account,
                // the actual base account exists under the base vesting account.
                // But, this can be different according to the version of cosmos-sdk.
                // So, anyway, try to parse it by some ways...
                const baseVestingAccount =
                    value.BaseVestingAccount ||
                    value.baseVestingAccount ||
                    value.base_vesting_account;
                if (baseVestingAccount) {
                    value = baseVestingAccount;

                    const baseAccount =
                        value.BaseAccount || value.baseAccount || value.base_account;
                    if (baseAccount) {
                        value = baseAccount;
                    }
                }

                // Handle nested account like Desmos
                const nestedAccount = value.account
                if(nestedAccount){
                    value = nestedAccount
                }

                return value
            })
            .catch((error) => {
                if(error.response?.status === 404){
                    throw new Error('Account does not exist on chain')
                }else{
                    throw error
                }
            })
    }

    async simulate(address: string, messages: Message[], memo: string|undefined = undefined, modifier: number|undefined = undefined) {
        const account = await this.getAccount(address)
        const fee = this.getFee(100_000)
        const txBody = {
            bodyBytes: this.makeBodyBytes(messages, memo),
            authInfoBytes: await this.makeAuthInfoBytes(account, fee, SignMode.SIGN_MODE_UNSPECIFIED),
            signatures: [new Uint8Array()],
        }

        try {
            const estimate = await axios.post(this.network.restUrl + '/cosmos/tx/v1beta1/simulate', {
                tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
            }).then(el => el.data.gas_info.gas_used)

            return parseInt((estimate * (modifier || this.defaultGasModifier)).toString());
        } catch (error: any) {
            throw new Error(error.response?.data?.message || error.message)
        }
    }

    async signAndBroadcast(address: string, messages: Message[], memo?: string, gasPrice?: GasPrice|string, gas?: number, fee?: Fee|undefined) {
        if (!fee) {
            if (gas === undefined || gas === 0)
                gas = await this.simulate(address, messages, memo);
            fee = this.getFee(gas, gasPrice);
        }
        const txBody = await this.sign(address, messages, memo, fee)

        return this.broadcast(txBody)
    }

    async sign(address: string, messages: Message[], memo: string|undefined = undefined, fee: Fee){
        const account = await this.getAccount(address)
        const { account_number: accountNumber } = account
        const txBodyBytes = this.makeBodyBytes(messages, memo)
        // Sign using standard protobuf messages
        const authInfoBytes = await this.makeAuthInfoBytes(account, fee, SignMode.SIGN_MODE_DIRECT)
        const signDoc = makeSignDoc(txBodyBytes, authInfoBytes, this.network.chainId, accountNumber);
        const { signature, signed } = await this.signer.signDirect(address, signDoc);
        return {
            bodyBytes: signed.bodyBytes,
            authInfoBytes: signed.authInfoBytes,
            signatures: [fromBase64(signature.signature)],
        }
    }

    async broadcast(txBody: any): Promise<DeliverTxResponse> {
        const timeoutMs = this.network.txTimeout || 60_000
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
                return pollForTx(txId);
            }
        };

        const response = await axios.post(this.network.restUrl + '/cosmos/tx/v1beta1/txs', {
            tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
            mode: "BROADCAST_MODE_SYNC"
        })
        const result = parseTxResult(response.data.tx_response)
        assertIsDeliverTxSuccess(result)
        return pollForTx(result.transactionHash).then(
            (value: any) => {
                clearTimeout(txPollTimeout);
                assertIsDeliverTxSuccess(value)
                return value
            },
            (error: any) => {
                clearTimeout(txPollTimeout);
                return error
            },
        )
    }

    // vendored to handle large integers
    // https://github.com/cosmos/cosmjs/blob/0f0c9d8a754cbf01e17acf51d3f2dbdeaae60757/packages/stargate/src/fee.ts
    calculateFee(gasLimit: number, gasPrice: GasPrice|string) {
        const processedGasPrice = typeof gasPrice === "string" ? GasPrice.fromString(gasPrice) : gasPrice;
        const { denom, amount: gasPriceAmount } = processedGasPrice;
        // @ts-ignore
        const amount = mathjs.ceil(mathjs.bignumber(mathjs.multiply(mathjs.bignumber(gasPriceAmount.toString()), mathjs.bignumber(gasLimit.toString()))));
        return {
            amount: [coin(amount, denom)],
            gas: gasLimit.toString()
        };
    }

    getFee(gas: number, gasPrice?: GasPrice|string|undefined): Fee {
        if (!gas)
            gas = 200000;

        const fee = this.calculateFee(gas, gasPrice || this.defaultGasPrice);

        return Fee.fromPartial({
            amount: fee.amount,
            gasLimit: fee.gas,
        });
    }

    pubkeyTypeUrl(pub_key: undefined|{'@type': string}): string {
        if(pub_key && pub_key['@type']) return pub_key['@type']

        if(this.network.chain_name === 'injective'){
            return '/injective.crypto.v1beta1.ethsecp256k1.PubKey'
        }

        if(this.network.coinType === 60){
            return '/ethermint.crypto.v1.ethsecp256k1.PubKey'
        }
        return '/cosmos.crypto.secp256k1.PubKey'
    }

    async makeAuthInfoBytes(account: any, fee: Fee, mode: any){
        const { sequence } = account
        const accountFromSigner = (await this.signer.getAccounts())[0]
        if (!accountFromSigner) {
            throw new Error("Failed to retrieve account from signer");
        }
        const signerPubkey = accountFromSigner.pubkey;
        return AuthInfo.encode({
            signerInfos: [
                {
                    publicKey: {
                        typeUrl: this.pubkeyTypeUrl(account.pub_key),
                        value: PubKey.encode({
                            key: signerPubkey,
                        }).finish(),
                    },
                    sequence: Long.fromNumber(sequence, true),
                    modeInfo: { single: { mode: mode } },
                },
            ],
            fee: fee,
        }).finish()
    }

    makeBodyBytes(messages: Message[], memo: string|undefined = undefined) {
        const anyMsgs = messages.map((m) => this.registry.encodeAsAny(m));
        return TxBody.encode(
            TxBody.fromPartial({
                messages: anyMsgs,
                memo: memo,
            })
        ).finish()
    }
}