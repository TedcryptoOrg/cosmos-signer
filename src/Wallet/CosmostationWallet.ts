import BaseWallet, {type Provider, type WalletClient} from "./BaseWallet";
import type {NetworkData} from "../types";

export default class CosmostationWallet extends BaseWallet {
    public name = 'cosmostation'
    public label = 'Cosmostation Wallet'
    public keychangeEvent = 'cosmostation_keystorechange'

    protected authzAminoLiftedValueSupport = false

    constructor(keplrProvider: Provider, private readonly cosmostationProvider: Provider) {
        super(keplrProvider)
    }

    async getSigner(network: NetworkData): Promise<WalletClient|null> {
        if(this.signer === null){
            const { chainId } = network
            if(this.isLedger()){
                this.signer = await this.provider.getOfflineSignerOnlyAmino(chainId)
            }else{
                this.signer = await this.provider.getOfflineSigner(chainId)
            }
        }

        return this.signer
    }

    async suggestChain(network: NetworkData): Promise<any> {
        return await this.cosmostationProvider.request({
            method: 'cos_addChain',
            params: this.suggestChainData(network)
        })
    }

    private suggestChainData(network: NetworkData): any {
        return {
            chainId: network.chainId,
            chainName: network.prettyName,
            addressPrefix: network.prefix,
            baseDenom: network.denom,
            displayDenom: network.symbol,
            restURL: network.restUrl,
            coinType: `${network.slip44}`, // optional (default: '118')
            decimals: network.decimals, // optional (default: 6)
            gasRate: {
                // optional (default: { average: '0.025', low: '0.0025', tiny: '0.00025' })
                average: `${network.gasPriceStep.high}`,
                low: `${network.gasPriceStep.average}`,
                tiny: `${network.gasPriceStep.low}`
            },
            // sendGas: "80000", // optional (default: '100000')
            ...((network.data.keplrFeatures?.includes('eth-address-gen') ?? network.slip44 === 60)
                ? {type: 'ETHERMINT'} : {})
        }
    }
}