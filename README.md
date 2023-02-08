# Cosmos Signer

This is a simple implementation of a signer in cosmos. With it, you will be able to simulate, 
sign and broadcast transactions easily without having to worry about the network details.

## How to use

```js
import { SigningClient } from '@tedcryptoorg/cosmos-signer';
import { coins, coin } from "@cosmjs/launchpad";
import { GasPrice } from "@cosmjs/launchpad";
import { Message } from '@tedcryptoorg/cosmos-signer/dist/types';

const network: Network = {
    chain_name: 'juno',
    authzAminoSupport: true,
    prefix: 'juno',
    txTimeout: 1000,
    coinType: 66,
    chainId: 'juno-1',
}

const offlineSignerAmino = await window.keplr.getOfflineSignerOnlyAmino(chain.chainId);
const accounts = await offlineSignerAmino.getAccounts();

const messages: Message[] = [{
    typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
    value: {
        delegatorAddress: accounts[0].address,
        validatorAddress: validatorAddress,
        amount: coin(amount.toString(), chainDenom),
    },
}];

const signer = new SigningClient(network, GasPrice.fromString('0.025ujuno'), window.keplr);
try {
    gasFee = await signer.simulate(address, messages)
} catch (error) {
    throw new Error('Failed to simulate gas fees. Please try again.')
}


signer.signAndBroadcast(window.keplr.getAccounts()[0].address, messages, gasFee);
```
