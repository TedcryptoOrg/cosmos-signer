import { ETH } from '@evmos/address-converter'
import Bech32 from 'bech32'

import * as BytesUtils from '@ethersproject/bytes'
import { keccak256 } from '@ethersproject/keccak256'
import { encodeSecp256k1Signature, type StdSignature } from '@cosmjs/amino'
import { makeSignBytes } from '@cosmjs/proto-signing'
import { type SignDoc } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { type AccountData } from '@cosmjs/proto-signing/build/signer'
import { type SignatureLike } from '@ethersproject/bytes'

export class EthSigner {
  constructor (
    private readonly signer: any,
    private readonly ethSigner: any,
    private readonly prefix: string
  ) {}

  async signDirect (_address: string, signDoc: SignDoc): Promise<{ signed: SignDoc, signature: StdSignature }> {
    const signature = await this.ethSigner
      ._signingKey()
      .signDigest(keccak256(makeSignBytes(signDoc))) as SignatureLike
    const splitSignature = BytesUtils.splitSignature(signature)
    const result = BytesUtils.arrayify(
      BytesUtils.concat([splitSignature.r, splitSignature.s])
    )
    const accounts = await this.getAccounts()
    if (accounts[0] === undefined) {
      throw new Error('No accounts found in wallet')
    }

    return {
      signed: signDoc,
      signature: encodeSecp256k1Signature(accounts[0].pubkey, result)
    }
  }

  async getAddress (): Promise<string> {
    const ethereumAddress = await this.ethSigner.getAddress() as string
    const data = ETH.decoder(ethereumAddress)
    return Bech32.encode(this.prefix, Bech32.toWords(data))
  }

  async getAccounts (): Promise<readonly AccountData[]> {
    return this.signer.getAccounts()
  }
}
