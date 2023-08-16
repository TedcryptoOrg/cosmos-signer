import { type Network } from '../types/Network'
import { Wallet } from '@ethersproject/wallet'
import { EthSigner } from './EthSigner'
import { Slip10RawIndex, pathToString } from '@cosmjs/crypto'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { type SignDoc } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { type AccountData } from '@cosmjs/proto-signing/build/signer'

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

  public static async createSigner (network: Network, mnemonic: string): Promise<Signer> {
    const hdPath = [
      Slip10RawIndex.hardened(44),
      Slip10RawIndex.hardened(network.coinType),
      Slip10RawIndex.hardened(0),
      Slip10RawIndex.normal(0),
      Slip10RawIndex.normal(0)
    ]
    if (network.coinType !== 118) {
      console.log('Using HD Path', pathToString(hdPath))
    }

    const signer = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: network.prefix,
      hdPaths: [hdPath]
    })

    if (network.coinType === 60) {
      const ethSigner = Wallet.fromMnemonic(mnemonic)
      return new Signer(new EthSigner(signer, ethSigner, network.prefix))
    }

    return new Signer(signer)
  }
}
