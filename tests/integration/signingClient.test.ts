import { describe, expect, it, jest } from '@jest/globals';
import {SigningClient} from '../../src';
import { coin, GasPrice } from '@cosmjs/stargate';
import {fixedNetworkData, fixedSignedClient} from '../Helper/fixedValues';

jest.retryTimes(3);
jest.setTimeout(60000);

describe('SigningClient', () => {
    it('should be able to create a signing client from a chain directory', async () => {
        const signingClient = await fixedSignedClient();

        expect(signingClient).toBeInstanceOf(SigningClient);
        expect(signingClient.calculateFee(1000000, GasPrice.fromString('0uosmo')))
            .toEqual({"amount": [{"amount": "0", "denom": "uosmo"}], "gas": BigInt("1000000")});
        expect(signingClient.calculateFee(1000000, GasPrice.fromString('1uosmo')))
            .toEqual({"amount": [{"amount": "1000000", "denom": "uosmo"}], "gas": BigInt("1000000")});
    });

    it('should estimate fees for a given network (osmosis)', async () => {
        const signingClient = await fixedSignedClient();
        await signingClient.wallet.connect(await fixedNetworkData('osmosis'))

        const message: any = {
            typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
            value: {
                delegatorAddress: 'osmo1xk23a255qm4kn6gdezr6jm7zmupn23t3mh63ya',
                validatorAddress: 'osmovaloper1xk23a255qm4kn6gdezr6jm7zmupn23t3pqjjn6',
                amount: coin('1', 'uosmo'),
            },
        };

        expect(await signingClient.simulate('osmo1xk23a255qm4kn6gdezr6jm7zmupn23t3mh63ya', [message])).toBeGreaterThan(100);
    });

    it('should estimate fees for a given network (migaloo)', async () => {
        const signingClient = await fixedSignedClient('migaloo');
        await signingClient.wallet.connect(await fixedNetworkData('migaloo'))

        const message: any = {
            typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
            value: {
                delegatorAddress: 'migaloo1r37anntu9wgk06jeycatp2npmytqugq54tkwju',
                validatorAddress: 'migaloovaloper1r37anntu9wgk06jeycatp2npmytqugq586jzsh',
                amount: coin('1', 'uwhale'),
            },
        };

        expect(await signingClient.simulate('migaloo1r37anntu9wgk06jeycatp2npmytqugq54tkwju', [message])).toBeGreaterThan(100);
    });
});