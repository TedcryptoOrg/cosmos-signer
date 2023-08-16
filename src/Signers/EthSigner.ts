import { ETH } from "@evmos/address-converter";
import Bech32 from "bech32";

import * as BytesUtils from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import {encodeSecp256k1Signature, StdSignature} from '@cosmjs/amino';
import { makeSignBytes } from "@cosmjs/proto-signing";
import {SignDoc} from "cosmjs-types/cosmos/tx/v1beta1/tx";
import {AccountData} from "@cosmjs/proto-signing/build/signer";

export class EthSigner {
    constructor(
        private readonly signer: any,
        private readonly ethSigner: any,
        private readonly prefix: string
    ){}

    async signDirect(_address: string, signDoc: SignDoc): Promise<{signed: SignDoc, signature: StdSignature}> {
        const signature = await this.ethSigner
            ._signingKey()
            .signDigest(keccak256(makeSignBytes(signDoc)));
        const splitSignature = BytesUtils.splitSignature(signature);
        const result = BytesUtils.arrayify(
            BytesUtils.concat([splitSignature.r, splitSignature.s])
        );
        const accounts = await this.getAccounts();
        if (accounts[0] === undefined) {
            throw new Error('No accounts found in wallet')
        }

        return {
            signed: signDoc,
            signature: encodeSecp256k1Signature(accounts[0].pubkey, result)
        }
    }

    async getAddress(): Promise<string> {
        const ethereumAddress = await this.ethSigner.getAddress();
        const data = ETH.decoder(ethereumAddress);
        return Bech32.encode(this.prefix, Bech32.toWords(data))
    }

    getAccounts(): Promise<readonly AccountData[]> {
        return this.signer.getAccounts()
    }
}