import { describe, expect, it } from '@jest/globals';
import { TEST_MNEMONIC } from '../../Helper/fixedValues';
import { ChainDirectory } from '@tedcryptoorg/cosmos-directory';
import { DefaultSigner } from '../../../src';

describe('EthSigner', () => {
    it('should be able to create and get the right address', async () => {
        const {chain} = await new ChainDirectory().getChainData('evmos');
        const ethSigner = await DefaultSigner.createSigner(chain, TEST_MNEMONIC);

        expect(await ethSigner.getAddress()).toEqual('evmos1va984xzrrznkugjapt6wpklwwr0psfvph6kqr3');
    });
});