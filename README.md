# Cosmos DefaultAdapter

This is a simple implementation of a signer in cosmos. With it, you will be able to simulate, 
sign and broadcast transactions easily without having to worry about the network details.

## How to use

Install:

```js
npm i @tedcryptoorg/cosmos-signer
```

Simple code example:

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
    const signer = await DefaultAdapter.createSigner(chain, mnemonic)
    return await signer.getAddress()
}

const address =
... // Get address from keplr or mnemonic using functions above

const messages: Message[] = [{
    typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
    value: {
        delegatorAddress: address,
        validatorAddress: validatorAddress,
        amount: coin(amount.toString(), chainDenom),
    },
}];

const network = NetworkData.createFromChain('juno-1')
const signer = new SigningClient(network, GasPrice.fromString('0.025ujuno'), window.keplr);
const result = signer.signAndBroadcast(address, messages, 0); // 0 fee, let it simulate before broadcast (or use .simulate fn)

console.log(result)
```
