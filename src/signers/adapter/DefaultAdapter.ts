import { AuthInfo, type Fee, TxBody } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";
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
import {PubKey} from "cosmjs-types/cosmos/crypto/secp256k1/keys";
import { defaultRegistryTypes as defaultStargateTypes } from '@cosmjs/stargate/build/signingstargateclient'
import { fromBase64 } from '@cosmjs/encoding'
import {type AminoMsg, makeSignDoc as makeAminoSignDoc} from "@cosmjs/amino";
import { makeSignDoc, Registry } from "@cosmjs/proto-signing";
import _ from "lodash";
import Long from "long";
import type {Wallet} from "../../wallet/BaseWallet";
import type {NetworkData} from "../../types/NetworkData";
import {createAuthzExecAminoConverters, createAuthzAminoConverters as customCreateAuthzAminoConverters} from "../../converters/Authz";
import type {Account} from "../../types/Account";
import type {Message} from "../../types/Message";

export class DefaultAdapter {
    private readonly registry: Registry

    private readonly aminoTypes: AminoTypes

    constructor(
        private readonly network: NetworkData,
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
        this.aminoTypes = new AminoTypes({
            ...defaultConverters,
            ...customCreateAuthzAminoConverters(),
            ...createAuthzExecAminoConverters(this.registry, aminoTypes)
        })
    }

    async sign(account: Account, messages: Message[], fee: Fee, memo?: string): Promise<any> {
        const { chainId } = this.network
        const { account_number: accountNumber, sequence, address } = account
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
        }

        if(this.wallet.signDirectSupport()){
            // Sign using standard protobuf messages
            const authInfoBytes = await this.makeAuthInfoBytes(account, fee, SignMode.SIGN_MODE_DIRECT)
            const signDoc = makeSignDoc(this.makeBodyBytes(messages, memo), authInfoBytes, chainId, accountNumber);
            const { signature, signed } = await this.wallet.signDirect(address, signDoc);

            return {
                bodyBytes: signed.bodyBytes,
                authInfoBytes: signed.authInfoBytes,
                signatures: [fromBase64(signature.signature)],
            }
        }

        throw new Error('Unable to sign message with this wallet/signer')
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
                if(!this.network.authzAminoSupport){
                    throw new Error('This chain does not support amino conversion for Authz messages')
                }
                if(this.network.authzAminoGenericOnly && this.wallet.signDirectSupport()){
                    throw new Error('This chain does not fully support amino conversion for Authz messages, using signDirect instead')
                }
            }
            if(message.typeUrl === '/cosmos.authz.v1beta1.MsgExec'){
                // @ts-ignore
                const execTypes = message.value.msgs.map((msg: Message) => msg.typeUrl)
                const preventedTypes = execTypes.filter((type: string) => this.network.authzAminoExecPreventTypes.some((prevent: any) => type.match(_.escapeRegExp(prevent))))
                if(preventedTypes.length > 0){
                    throw new Error(`This chain does not support amino conversion for Authz Exec with message types: ${preventedTypes.join(', ')}`)
                }
            }else if(this.network.aminoPreventTypes.some((prevent: any) => message.typeUrl.match(_.escapeRegExp(prevent)))){
                throw new Error(`This chain does not support amino conversion for message type: ${message.typeUrl}`)
            }
            let aminoMessage = this.aminoTypes.toAmino(message)
            if(this.network.authzAminoLiftedValues){
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

        if (this.network.path === 'injective') {
            return '/injective.crypto.v1beta1.ethsecp256k1.PubKey'
        }

        if (this.network.slip44 === 60) {
            return '/ethermint.crypto.v1.ethsecp256k1.PubKey'
        }
        return '/cosmos.crypto.secp256k1.PubKey'
    }
}