import {ChainDirectory} from "@tedcryptoorg/cosmos-directory";
import {Network} from "../../src/Network";

describe('Network', () => {
    it('we can create from a chain', async () => {
        const chain = (await new ChainDirectory().getChainData('osmosis')).chain;
        expect(chain).not.toBeNull();

        const network = Network.createFromChain(chain);
        expect(network).not.toBeNull();
        expect(network.data).toEqual({
            chain_name: 'osmosis',
            authzAminoSupport: true,
            prefix: 'osmo',
            txTimeout: 1000,
            coinType: 118,
            chainId: 'osmosis-1',
            restUrl: 'https://rest.cosmos.directory/osmosis'
        });
    })
})