import BaseWallet, {Provider} from "./BaseWallet";
import {NetworkData} from "../types";
import {DefaultSigner} from "../Signers";

export default class CosmostationWallet extends BaseWallet {
    public name = 'cosmostation'
    public label = 'Cosmostation Wallet'
    public keychangeEvent = 'cosmostation_keystorechange'

    protected authzAminoLiftedValueSupport = false

    constructor(keplrProvider: Provider, private cosmostationProvider: Provider) {
        super(keplrProvider)
    }

    async getSigner(network: NetworkData): Promise<DefaultSigner|null> {
        if(!this.signer){
            const { chainId } = network
            if(this.isLedger()){
                this.signer = await this.provider.getOfflineSignerOnlyAmino(chainId)
            }else{
                this.signer = await this.provider.getOfflineSigner(chainId)
            }
        }
        return this.signer
    }

    suggestChain(network: NetworkData) {
        return this.cosmostationProvider.request({
            method: 'cos_addChain',
            params: this.suggestChainData(network)
        })
    }

    suggestChainData(network: NetworkData): any {
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
            ...((network.data.keplrFeatures?.includes('eth-address-gen') || network.slip44 === 60)
                ? {type: 'ETHERMINT'} : {})
        }
    }
}