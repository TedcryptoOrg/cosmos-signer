import type {Logger} from "../Logger";
import type {NetworkData} from "../types/NetworkData";

export interface Wallet {
    available: () => boolean

    connected: () => boolean

    isLedger: () => boolean

    signDirectSupport: () => boolean

    signAminoSupport: () => boolean

    connect: (network: NetworkData) => Promise<ProviderKey | null>

    disconnect: () => void

    enable: (network: NetworkData) => Promise<void>

    getKey: (network: NetworkData) => Promise<ProviderKey | null>

    getSigner: (network: NetworkData) => Promise<WalletClient | null>

    getAddress: () => Promise<string>

    getAccounts: () => Promise<any>

    signDirect: (...args: any[]) => Promise<any>

    signAmino: (...args: any[]) => Promise<any>

    suggestChain: (network: NetworkData) => Promise<void>

    suggestChainData: (network: NetworkData) => any

    getOptions: () => any

    setOptions: (options: any) => any
}

export interface WalletClient {
    signDirect: (...args: any[]) => Promise<any>
    signAmino: (...args: any[]) => Promise<any>
    getAddress: () => Promise<string>
    getAccounts: () => Promise<any>
}

export interface Provider {
    enable: (chainId: string) => Promise<void>
    request: (data: any) => Promise<any>
    getKey: (chainId: string) => Promise<ProviderKey>
    getOfflineSignerOnlyAmino: (chainId: string) => Promise<any>
    getOfflineSignerAuto: (chainId: string) => Promise<any>
    getOfflineSigner: (chainId: string) => Promise<any>
    experimentalSuggestChain: (data: any) => Promise<void>
    defaultOptions: any
}

export interface ProviderKey {
    name: string // Name of the selected key store.
    algo: string
    pubKey: Uint8Array
    address: Uint8Array
    bech32Address: string
    isNanoLedger: boolean
    isHardware?: boolean
}

export default class BaseWallet implements Wallet {
    protected key: ProviderKey | null = null
    protected signer: WalletClient | null = null
    protected suggestChainSupport = true
    protected options: any = {}

    constructor(
        protected provider: Provider,
        protected readonly logger?: Logger
    ) {
    }

    available(): boolean {
        return !!this.provider
    }

    connected(): boolean {
        return this.available()
    }

    isLedger(): boolean {
        return this.key?.isNanoLedger ?? this.key?.isHardware ?? false;
    }

    signDirectSupport(): boolean {
        return !!this.signer?.signDirect
    }

    signAminoSupport(): boolean {
        return !!this.signer?.signAmino
    }

    getOptions(): any {
        return this.options;
    }

    setOptions(options: any): void {
        this.options = options;
    }

    async connect(network: NetworkData): Promise<ProviderKey | null> {
        this.key = null
        this.signer = null
        try {
            await this.enable(network)
            await this.getKey(network)
            await this.getSigner(network)

            return this.key
        } catch (e) {
            this.logger?.log(e)
            if (!this.suggestChainSupport) {
                this.logger?.log('Suggest chain not supported', network, e)
                throw new Error('Failed to connect wallet and suggest chain is not supported.')
            }
            try {
                await this.suggestChain(network)
                await this.getKey(network)
                await this.getSigner(network)

                return this.key
            } catch (s) {
                this.logger?.log('Failed to suggest the chain and connect', e, s)
                throw new Error('Failed to connect wallet and suggest chain')
            }
        }
    }

    disconnect(): void {
        this.key = null
        this.signer = null

        this.logger?.log('Disconnecting wallet')
    }

    async enable(network: NetworkData): Promise<void> {
        const {chainId} = network

        await this.provider.enable(chainId);
    }

    async getKey(network: NetworkData): Promise<ProviderKey | null> {
        if (this.key === null) {
            const {chainId} = network
            this.key = await this.provider.getKey(chainId)
        }

        return this.key
    }

    async getSigner(network: NetworkData): Promise<WalletClient | null> {
        if (!this.signer) {
            const {chainId} = network
            this.signer = await this.provider.getOfflineSignerAuto(chainId)
        }

        return this.signer
    }

    async getAddress(): Promise<string> {
        if (this.signer?.getAddress) {
            return await this.signer.getAddress()
        } else {
            const accounts = await this.getAccounts();
            if (accounts === undefined || accounts.length === 0) {
                throw new Error('No accounts found in wallet')
            }

            return accounts[0].address as string;
        }
    }

    async getAccounts(): Promise<any> {
        return await this.signer?.getAccounts();
    }

    async signDirect(...args: any[]): Promise<any> {
        return await this.signer?.signDirect(...args);
    }

    async signAmino(...args: any[]): Promise<any> {
        return await this.signer?.signAmino(...args);
    }

    async suggestChain(network: NetworkData): Promise<void> {
        if (this.suggestChainSupport) {
            await this.provider.experimentalSuggestChain(this.suggestChainData(network)); 
        } else {
            throw new Error(`${network.prettyName} (${network.chainId}) is not supported`)
        }
    }

    suggestChainData(network: NetworkData): any {
        const currency: {
            coinDenom: string
            coinMinimalDenom: string
            coinDecimals: number
            coinGeckoId?: string
        } = {
            coinDenom: network.symbol,
            coinMinimalDenom: network.denom,
            coinDecimals: network.decimals
        }
        if (network.coinGeckoId) {
            currency.coinGeckoId = network.coinGeckoId
        }

        return {
            rpc: network.rpcUrl,
            rest: network.restUrl,
            chainId: network.chainId,
            chainName: network.prettyName,
            stakeCurrency: currency,
            bip44: {coinType: network.slip44},
            walletUrlForStaking: "https://restake.app/" + network.name,
            bech32Config: {
                bech32PrefixAccAddr: network.prefix,
                bech32PrefixAccPub: network.prefix + "pub",
                bech32PrefixValAddr: network.prefix + "valoper",
                bech32PrefixValPub: network.prefix + "valoperpub",
                bech32PrefixConsAddr: network.prefix + "valcons",
                bech32PrefixConsPub: network.prefix + "valconspub"
            },
            currencies: [currency],
            feeCurrencies: [{...currency, gasPriceStep: network.gasPriceStep}],
            ...(network.data.keplrFeatures !== undefined
                    ? {features: network.data.keplrFeatures}
                    : (network.slip44 === 60
                        ? {features: ["ibc-transfer", "ibc-go", "eth-address-gen", "eth-key-sign"]}
                        : {})
            )
        }
    }
}