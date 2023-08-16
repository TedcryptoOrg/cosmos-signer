import {Network} from "./types/Network";
import axios from "axios";
import {Chain, CosmosDirectory} from "@tedcryptoorg/cosmos-directory";
import {assertIsDeliverTxSuccess, GasPrice} from "@cosmjs/stargate";
import {coin} from "./util/Coin";
import _ from "lodash";
import {Message} from "./types/Message";
import {fromBase64, toBase64} from "@cosmjs/encoding";
import {AuthInfo, Fee, TxBody, TxRaw} from "cosmjs-types/cosmos/tx/v1beta1/tx";
import {SignMode} from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import {sleep} from "@cosmjs/utils";
import {PubKey} from "cosmjs-types/cosmos/crypto/secp256k1/keys";
import {Buffer} from "buffer";
import {Amino} from "./Amino";
import { makeSignDoc as makeAminoSignDoc } from "@cosmjs/amino";
import { makeSignDoc, Registry } from "@cosmjs/proto-signing";
import {parseTxResult} from "./util/TransactionHelper";

const mathjs = require('mathjs');
const Long = require('long');

export class SigningClient {
    private readonly network: Network;
    private registry: Registry;
    private cosmosDirectory: CosmosDirectory;
    private readonly defaultGasPrice: GasPrice;
    private defaultGasModifier: number;
    private signer: any;
    private amino: Amino

    constructor(network: Network, defaultGasPrice: GasPrice, signer: any, defaultGasModifier: number = 1.5) {
        this.network = network;
        this.registry = require('./Registry').registry.getProtoSigningRegistry();
        this.cosmosDirectory = new CosmosDirectory();
        this.defaultGasPrice = defaultGasPrice;
        this.signer = signer;
        this.defaultGasModifier = defaultGasModifier;
        this.amino = new Amino(this.network);
    }

    static async createWithChain(chain: Chain, defaultGasPrice: GasPrice, signer: any, defaultGasModifier: number = 1.5): Promise<SigningClient> {
        return new SigningClient(
            {
                chain_name: chain.name,
                authzAminoSupport: chain.params.authz ?? false,
                prefix: chain.bech32_prefix,
                txTimeout: 1000,
                coinType: chain.slip44,
                chainId: chain.chain_id,
            }, defaultGasPrice, signer, defaultGasModifier)
    }

    async getAccount(address: string) {
        return axios
            .get(this.cosmosDirectory.restUrl(this.network.chain_name) + "/cosmos/auth/v1beta1/accounts/" + address)
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

    getFee(gas: number, gasPrice: GasPrice|string|undefined = undefined) {
        if (!gas)
            gas = 200000;
        return this.calculateFee(gas, gasPrice || this.defaultGasPrice);
    }

    async simulate(address: string, messages: Message[], memo: string|undefined = undefined, modifier: number|undefined = undefined) {
        const account = await this.getAccount(address)
        const fee = this.getFee(100_000)
        const txBody = {
            bodyBytes: this.makeBodyBytes(messages, memo),
            authInfoBytes: await this.makeAuthInfoBytes(account, {
                amount: fee.amount,
                gasLimit: fee.gas,
            }, SignMode.SIGN_MODE_UNSPECIFIED),
            signatures: [new Uint8Array()],
        }

        try {
            const estimate = await axios.post(this.cosmosDirectory.restUrl(this.network.chain_name) + '/cosmos/tx/v1beta1/simulate', {
                tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
            }).then(el => el.data.gas_info.gas_used)

            return parseInt((estimate * (modifier || this.defaultGasModifier)).toString());
        } catch (error: any) {
            throw new Error(error.response?.data?.message || error.message)
        }
    }

    async signAndBroadcast(address: string, messages: Message[], gas: number, memo: string|undefined = undefined, gasPrice: GasPrice|string|undefined = undefined) {
        if (!gas)
            gas = await this.simulate(address, messages, memo);
        const fee = this.getFee(gas, gasPrice);
        const txBody = await this.sign(address, messages, memo, fee)

        return this.broadcast(txBody)
    }

    async signAndBroadcastWithoutBalanceCheck(address: string, messages: Message[], gas: number, memo: string|undefined = undefined, gasPrice: GasPrice|string|undefined = undefined) {
        let defaultOptions
        if(this.signer.keplr.defaultOptions){
            defaultOptions = _.clone(this.signer.keplr.defaultOptions);
            this.signer.keplr.defaultOptions = {...defaultOptions, sign: { disableBalanceCheck: true }}
        }
        try {
            return await this.signAndBroadcast(address, messages, gas, memo, gasPrice)
        } finally {
            if(defaultOptions){
                this.signer.keplr.defaultOptions = defaultOptions
            }
        }
    }

    async sign(address: string, messages: Message[], memo: string|undefined = undefined, fee: any){
        const account = await this.getAccount(address)
        const { account_number: accountNumber, sequence } = account
        const txBodyBytes = this.makeBodyBytes(messages, memo)
        let aminoMsgs
        try {
            aminoMsgs = this.amino.convertToAmino(messages)
        } catch (e) { }
        if(aminoMsgs && this.signer.signAmino){

            // Sign as amino if possible for Ledger and Keplr support
            const signDoc = makeAminoSignDoc(aminoMsgs, fee, this.network.chainId, memo, accountNumber, sequence);
            const { signature, signed } = await this.signer.signAmino(address, signDoc);
            const authInfoBytes = await this.makeAuthInfoBytes(account, {
                amount: signed.fee.amount,
                gasLimit: signed.fee.gas,
            }, SignMode.SIGN_MODE_LEGACY_AMINO_JSON)
            return {
                bodyBytes: this.makeBodyBytes(messages, signed.memo),
                authInfoBytes: authInfoBytes,
                signatures: [Buffer.from(signature.signature, "base64")],
            }
        }else{
            // Sign using standard protobuf messages
            const authInfoBytes = await this.makeAuthInfoBytes(account, {
                amount: fee.amount,
                gasLimit: fee.gas,
            }, SignMode.SIGN_MODE_DIRECT)
            const signDoc = makeSignDoc(txBodyBytes, authInfoBytes, this.network.chainId, accountNumber);
            const { signature, signed } = await this.signer.signDirect(address, signDoc);
            return {
                bodyBytes: signed.bodyBytes,
                authInfoBytes: signed.authInfoBytes,
                signatures: [fromBase64(signature.signature)],
            }
        }
    }

    async makeAuthInfoBytes(account: any, fee: any, mode: any){
        const { sequence } = account
        const accountFromSigner = (await this.signer.getAccounts())[0]
        if (!accountFromSigner) {
            throw new Error("Failed to retrieve account from signer");
        }
        const pubkey = accountFromSigner.pubkey;
        return AuthInfo.encode({
            signerInfos: [
                {
                    publicKey: {
                        typeUrl:
                            this.network.coinType === 60
                                ? "/ethermint.crypto.v1.ethsecp256k1.PubKey"
                                : "/cosmos.crypto.secp256k1.PubKey",
                        value: PubKey.encode({
                            key: pubkey,
                        }).finish(),
                    },
                    sequence: Long.fromNumber(sequence, true),
                    modeInfo: { single: { mode: mode } },
                },
            ],
            fee: Fee.fromPartial(fee),
        }).finish()
    }

    async broadcast(txBody: any){
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
                const response = await axios.get(this.cosmosDirectory.restUrl(this.network.chain_name) + '/cosmos/tx/v1beta1/txs/' + txId);
                return parseTxResult(response.data.tx_response)
            } catch {
                return pollForTx(txId);
            }
        };

        const response = await axios.post(this.cosmosDirectory.restUrl(this.network.chain_name) + '/cosmos/tx/v1beta1/txs', {
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