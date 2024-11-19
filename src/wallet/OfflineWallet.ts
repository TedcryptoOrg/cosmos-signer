import { Slip10RawIndex, pathToString } from '@cosmjs/crypto'
import BaseWallet, {type Provider, type ProviderKey, type WalletClient} from "./BaseWallet";
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import type {NetworkData} from "../types/NetworkData";

export class OfflineWallet extends BaseWallet {
    public name = 'offline'
    public label = 'Offline Wallet'
    public keychangeEvent = 'offline_keystorechange'

    constructor(private readonly mnemonic: string, protected readonly logger?: any) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- This is a hack to avoid passing an empty object
        super({} as Provider, logger);
    }

    async connect(network: NetworkData): Promise<ProviderKey | null> {
        try {
            await this.getSigner(network)

            return null;
        } catch (error) {
            this.logger?.error('Failed to connect to offline wallet', error)
        }

        throw new Error('Failed to connect to offline wallet')
    }

    async getKey(): Promise<ProviderKey | null> {
        throw new Error('Offline wallet does not have a key');
    }

    async getSigner(network: NetworkData): Promise<WalletClient | null> {
        if (!this.signer) {
            const hdPath = [
                Slip10RawIndex.hardened(44),
                Slip10RawIndex.hardened(Number(network.slip44)),
                Slip10RawIndex.hardened(0),
                Slip10RawIndex.normal(0),
                Slip10RawIndex.normal(0)
            ]
            if (Number(network.slip44) !== 118) {
                this.logger?.log('Using HD Path', pathToString(hdPath))
            }

            // @ts-ignore
            this.signer = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
                prefix: network.bech32_prefix,
                hdPaths: [hdPath]
            }) as WalletClient
        }

        return this.signer
    }

    signDirectSupport(): boolean {
        return true
    }

    signAminoSupport(): boolean {
        return false
    }

    // @ts-ignore
    async signAmino(...args): Promise<any> {
        throw new Error('Amino signing is not supported in offline mode')
    }
}