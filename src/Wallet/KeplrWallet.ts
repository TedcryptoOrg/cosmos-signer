import BaseWallet from "./BaseWallet";
import {NetworkData} from "../types";
import {
    isMobile,
} from "@walletconnect/browser-utils";

export default class KeplrWallet extends BaseWallet {
    public name = 'keplr'
    public label = 'Keplr Wallet'
    public keychangeEvent = 'keplr_keystorechange'

    async connect(network: NetworkData) {
        if(this.provider){
            return super.connect(network)
        }else if(isMobile()){
            window.location.href = 'keplrwallet://';
            throw new Error('Please use the in-app browser to access REStake.')
        }

        throw new Error('Keplr wallet not available')
    }

    available() {
        return !!this.provider || isMobile()
    }

    // setOptions(options){
    //     return _.merge(this.provider.defaultOptions, options)
    // }
    //
    // getOptions(){
    //     return this.provider.defaultOptions
    // }
}