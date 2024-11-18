import { describe, expect, it } from '@jest/globals'
import { ChainDirectory } from '@tedcryptoorg/cosmos-directory'
import { Network } from '../../src'

describe('Network', () => {
    it('we can create from a chain', async () => {
        const {chain} = await new ChainDirectory().getChainData('osmosis')
        expect(chain).not.toBeNull()

        const network = await Network.createFromChain(chain)
        expect(network).not.toBeNull()
        expect(network.data.chain_name).toEqual('osmosis')
        expect(network.data.authzAminoSupport).toBeTruthy()
        expect(network.data.prefix).toEqual('osmo')
        expect(network.data.txTimeout).toEqual(1000)
        expect(network.data.coinType).toEqual(118)
        expect(network.data.chainId).toEqual('osmosis-1')
        expect(network.data.restUrl).toEqual('https://rest.cosmos.directory/osmosis')
    })
})