import BaseWallet from "./BaseWallet";

export class LeapWallet extends BaseWallet {
    protected name = 'leap'
    protected label = 'Leap Wallet'
    protected keychangeEvent = 'leap_keystorechange'
}
