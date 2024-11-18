import { describe, expect, it, jest } from '@jest/globals';
import {createOfflineWallet, fixedNetworkData} from '../../Helper/fixedValues';

jest.setTimeout(30000);
jest.retryTimes(3);

describe('OfflineWallet', () => {
    it('should be able to create and get the right address for cosmos chains', async () => {
        const wallet = createOfflineWallet();
        await wallet.connect(await fixedNetworkData())

        expect(await wallet.getAddress()).toEqual('osmo1dkn5h078g3g2fzhd2us2t4smh87atd8pyg5xy3');
        expect((await wallet.getAccounts()).length).toEqual(1);
    });

    // @todo: do we need to support evmos
    // it('should be able to create and get the right address for eth chains', async () => {
    //     const wallet = createOfflineWallet();
    //     await wallet.connect((await Network.createFromChain('evmos')).data)
    //
    //
    //     expect(await wallet.getAddress()).toEqual('evmos1va984xzrrznkugjapt6wpklwwr0psfvph6kqr3');
    //     expect((await wallet.getAccounts()).length).toEqual(1);
    // });
});