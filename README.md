# Cosmos Signer

This is a simple implementation of a signer in cosmos. With it, you will be able to simulate, 
sign and broadcast transactions easily without having to worry about the network details.

## How to use

```js
import {SigningClient} from '@tedcryptoorg/cosmos-signer';
import {coins, coin} from "@cosmjs/launchpad";
import {GasPrice} from "@cosmjs/launchpad";
import {Message} from '@tedcryptoorg/cosmos-signer/dist/types';

/**
 * Function to fetch address from keplr
 */
async function getKeplrAddress(): Promise<string> {
    const offlineSignerAmino = await window.keplr.getOfflineSignerOnlyAmino(chain.chainId);
    const accounts = await offlineSignerAmino.getAccounts();

    return accounts[0].address;
}

/**
 * Get address from mnemonic
 */
async function getWalletAddressFromMnemonic(mnemonic: string): Promise<string> {
    const signer = await Signer.createSigner(chain, mnemonic)
    return await signer.getAddress()
}

const address = ... // Get address from keplr or mnemonic using functions above

const messages: Message[] = [{
    typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
    value: {
        delegatorAddress: address,
        validatorAddress: validatorAddress,
        amount: coin(amount.toString(), chainDenom),
    },
}];

const network = Network.createFromChain('juno-1')
const signer = new SigningClient(network, GasPrice.fromString('0.025ujuno'), window.keplr);
try {
    gasFee = await signer.simulate(address, messages)
} catch (error) {
    throw new Error('Failed to simulate gas fees. Please try again.')
}


const result = signer.signAndBroadcast(address, messages, gasFee);
console.log(result)
```
