import { AuthInfo, type Fee, TxBody } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";
import type {Message,type Account} from "../types";
import {SignMode} from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import {
    createAuthzAminoConverters,
    createBankAminoConverters,
    createDistributionAminoConverters,
    createGovAminoConverters,
    createIbcAminoConverters,
    createStakingAminoConverters,
    AminoTypes,
} from "@cosmjs/stargate";
import type {Network} from "../Network";
import {createAuthzExecAminoConverters} from "../Converters/Authz";
import {PubKey} from "cosmjs-types/cosmos/crypto/secp256k1/keys";
import { defaultRegistryTypes as defaultStargateTypes } from '@cosmjs/stargate/build/signingstargateclient'
import type {Wallet} from "../Wallet";
import { fromBase64 } from '@cosmjs/encoding'
import {type AminoMsg, makeSignDoc as makeAminoSignDoc} from "@cosmjs/amino";
import { makeSignDoc, Registry } from "@cosmjs/proto-signing";
import _ from "lodash";
import Long from "long";

export class DefaultSigner {
    private readonly registry: Registry

    private readonly aminoTypes: AminoTypes

    constructor(
        private readonly network: Network,
        private readonly wallet: Wallet,
    ) {
        this.registry = new Registry(defaultStargateTypes);
        const defaultConverters = {
            ...createAuthzAminoConverters(),
            ...createBankAminoConverters(),
            ...createDistributionAminoConverters(),
            ...createGovAminoConverters(),
            ...createStakingAminoConverters(),
            ...createIbcAminoConverters(),
        }
        const aminoTypes = new AminoTypes(defaultConverters)
        this.aminoTypes = new AminoTypes({...defaultConverters, ...createAuthzExecAminoConverters(this.registry, aminoTypes)})
    }

    async sign(account: Account, messages: Message[], fee: Fee, memo?: string): Promise<any> {
        const { chainId } = this.network.data
        const { account_number: accountNumber, sequence, address } = account
        const txBodyBytes = this.makeBodyBytes(messages, memo)
        let aminoMsgs = undefined
        try {
            aminoMsgs = this.convertToAmino(messages)
        } catch (e) { console.log(e) }
        if(aminoMsgs && this.wallet.signAminoSupport()){
            // Sign as amino if possible for Ledger and Keplr support
            const signDoc = makeAminoSignDoc(aminoMsgs, {gas: fee.gasLimit.toString(), amount: fee.amount}, chainId, memo, accountNumber, sequence);
            const { signature, signed } = await this.wallet.signAmino(address, signDoc);
            const authInfoBytes = await this.makeAuthInfoBytes(account, fee, SignMode.SIGN_MODE_LEGACY_AMINO_JSON)
            return {
                bodyBytes: this.makeBodyBytes(messages, signed.memo),
                authInfoBytes,
                signatures: [Buffer.from(signature.signature, "base64")],
            }
        }else if(this.wallet.signDirectSupport()){
            // Sign using standard protobuf messages
            const authInfoBytes = await this.makeAuthInfoBytes(account, fee, SignMode.SIGN_MODE_DIRECT)
            const signDoc = makeSignDoc(txBodyBytes, authInfoBytes, chainId, accountNumber);
            const { signature, signed } = await this.wallet.signDirect(address, signDoc);
            return {
                bodyBytes: signed.bodyBytes,
                authInfoBytes: signed.authInfoBytes,
                signatures: [fromBase64(signature.signature)],
            }
        }else{
            throw new Error('Unable to sign message with this wallet/signer')
        }
    }

    async simulate(account: Account, messages: Message[], fee: Fee, memo?: string): Promise<any> {
        return {
            bodyBytes: this.makeBodyBytes(messages, memo),
            authInfoBytes: await this.makeAuthInfoBytes(account, fee, SignMode.SIGN_MODE_UNSPECIFIED),
            signatures: [new Uint8Array()],
        }
    }

    convertToAmino(messages: Message[]): AminoMsg[] {
        return messages.map((message: Message) => {
            if(message.typeUrl.startsWith('/cosmos.authz')){
                if(!this.network.data.authzAminoSupport){
                    throw new Error('This chain does not support amino conversion for Authz messages')
                }
                if(this.network.data.authzAminoGenericOnly && this.wallet.signDirectSupport()){
                    throw new Error('This chain does not fully support amino conversion for Authz messages, using signDirect instead')
                }
            }
            if(message.typeUrl === '/cosmos.authz.v1beta1.MsgExec'){
                // @ts-ignore
                const execTypes = message.value.msgs.map((msg: Message) => msg.typeUrl)
                const preventedTypes = execTypes.filter((type: string) => this.network.data.authzAminoExecPreventTypes.some((prevent: any) => type.match(_.escapeRegExp(prevent))))
                if(preventedTypes.length > 0){
                    throw new Error(`This chain does not support amino conversion for Authz Exec with message types: ${preventedTypes.join(', ')}`)
                }
            }else if(this.network.data.aminoPreventTypes.some(prevent => message.typeUrl.match(_.escapeRegExp(prevent)))){
                throw new Error(`This chain does not support amino conversion for message type: ${message.typeUrl}`)
            }
            let aminoMessage = this.aminoTypes.toAmino(message)
            if(this.network.data.authzAminoLiftedValues){
                switch (aminoMessage.type) {
                    case 'cosmos-sdk/MsgGrant':
                        aminoMessage = aminoMessage.value
                        // @ts-ignore
                        aminoMessage.grant.authorization = aminoMessage.grant.authorization.value
                        break;
                    case 'cosmos-sdk/MsgRevoke':
                        aminoMessage = aminoMessage.value
                        break;
                    case 'cosmos-sdk/MsgExec':
                        throw new Error('This chain does not support amino conversion for MsgExec')
                }
            }
            return aminoMessage
        })
    }

    makeBodyBytes(messages: Message[], memo?: string): Uint8Array {
        const anyMsgs = messages.map((m) => this.registry.encodeAsAny(m));
        return TxBody.encode(
            TxBody.fromPartial({
                messages: anyMsgs,
                memo,
            })
        ).finish()
    }

    async makeAuthInfoBytes(account: Account, fee: Fee, mode: SignMode): Promise<Uint8Array> {
        const {sequence} = account
        const accountFromSigner = (await this.wallet.getAccounts())[0]
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
                    // @ts-ignore
                    sequence: Long.fromNumber(sequence, true),
                    modeInfo: {single: {mode}},
                },
            ],
            fee,
        }).finish()
    }

    pubkeyTypeUrl(pub_key: any) {
        if (pub_key?.['@type']) return pub_key['@type']

        if (this.network.data.path === 'injective') {
            return '/injective.crypto.v1beta1.ethsecp256k1.PubKey'
        }

        if (this.network.data.slip44 === 60) {
            return '/ethermint.crypto.v1.ethsecp256k1.PubKey'
        }
        return '/cosmos.crypto.secp256k1.PubKey'
    }
}