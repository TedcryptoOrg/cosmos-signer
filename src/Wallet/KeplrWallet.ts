import BaseWallet from "./BaseWallet";
import _ from "lodash";

export default class KeplrWallet extends BaseWallet {
    public name = 'keplr'
    public label = 'Keplr Wallet'
    public keychangeEvent = 'keplr_keystorechange'

    setOptions(options: any): void{
        _.merge(this.provider.defaultOptions, options)
    }

    getOptions(): any{
        return this.provider.defaultOptions
    }
}