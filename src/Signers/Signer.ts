import { Wallet } from '@ethersproject/wallet'
import { EthSigner } from './EthSigner'
import { Slip10RawIndex, pathToString } from '@cosmjs/crypto'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { type SignDoc } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { type AccountData } from '@cosmjs/proto-signing/build/signer'
import { type Chain } from '@tedcryptoorg/cosmos-directory'

export class Signer {
  constructor (
    public readonly signer: DirectSecp256k1HdWallet | EthSigner
  ) {}

  async getAddress (): Promise<string> {
    if (this.signer instanceof DirectSecp256k1HdWallet) {
      const accounts = await this.signer.getAccounts()
      if (accounts[0] === undefined) {
        throw new Error('No accounts found in wallet')
      }

      return accounts[0].address
    }

    return await this.signer.getAddress()
  }

  async getAccounts (): Promise<readonly AccountData[]> {
    if (this.signer instanceof DirectSecp256k1HdWallet) {
      return await this.signer.getAccounts()
    }

    return await this.signer.getAccounts()
  }

  async signDirect (_address: string, signDoc: SignDoc): Promise<{ signed: any, signature: any }> {
    if (this.signer instanceof DirectSecp256k1HdWallet) {
      return await this.signer.signDirect(_address, signDoc)
    }

    return await this.signer.signDirect(_address, signDoc)
  }

  public static async createSigner (chain: Chain, mnemonic: string): Promise<Signer> {
    const hdPath = [
      Slip10RawIndex.hardened(44),
      Slip10RawIndex.hardened(chain.slip44),
      Slip10RawIndex.hardened(0),
      Slip10RawIndex.normal(0),
      Slip10RawIndex.normal(0)
    ]
    if (chain.slip44 !== 118) {
      console.log('Using HD Path', pathToString(hdPath))
    }

    const signer = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: chain.bech32_prefix,
      hdPaths: [hdPath]
    })

    if (chain.slip44 === 60) {
      const ethSigner = Wallet.fromMnemonic(mnemonic)
      return new Signer(new EthSigner(signer, ethSigner, chain.bech32_prefix))
    }

    return new Signer(signer)
  }
}
