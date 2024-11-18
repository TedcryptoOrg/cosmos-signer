import BaseWallet from "./BaseWallet";
import {isMobile} from "@walletconnect/browser-utils";
import {NetworkData} from "../types";

export default class LeapWallet extends BaseWallet {
    protected name = 'leap'
    protected label = 'Leap Wallet'
    protected keychangeEvent = 'leap_keystorechange'

    async connect(network: NetworkData) {
        if(this.provider){
            return super.connect(network)
        }else if(isMobile()){
            window.location.href = 'https://leapcosmoswallet.page.link/HawhyWcCuygLbkvT6';
            throw new Error('Please use the in-app browser to access REStake.')
        }
        
        throw new Error('Leap wallet not available')
    }

    available() {
        return !!this.provider || isMobile()
    }
}
