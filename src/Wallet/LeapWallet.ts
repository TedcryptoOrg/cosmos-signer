import BaseWallet from "./BaseWallet";

export default class LeapWallet extends BaseWallet {
    protected name = 'leap'
    protected label = 'Leap Wallet'
    protected keychangeEvent = 'leap_keystorechange'
}
