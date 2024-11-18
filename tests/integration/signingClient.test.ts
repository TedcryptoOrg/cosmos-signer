import { describe, expect, it, jest } from '@jest/globals';
import { ChainDirectory } from '@tedcryptoorg/cosmos-directory';
import {Network, SigningClient} from '../../src';
import { coin, GasPrice } from '@cosmjs/stargate';
import { createSigner } from '../Helper/fixedValues';
import { Fee } from 'cosmjs-types/cosmos/tx/v1beta1/tx';

jest.retryTimes(3);
jest.setTimeout(60000);

describe('SigningClient', () => {
    it('should be able to create a signing client from a chain directory', async () => {
        const {chain} = await new ChainDirectory().getChainData('osmosis');
        const signer = await createSigner('osmosis');

        const signingClient = new SigningClient(Network.createFromChain(chain).data, GasPrice.fromString('0uosmo'), signer);
        expect(signingClient).toBeInstanceOf(SigningClient);
        expect(signingClient.calculateFee(1000000, GasPrice.fromString('0uosmo')))
            .toEqual({"amount": [{"amount": "0", "denom": "uosmo"}], "gas": BigInt("1000000")});
        expect(signingClient.calculateFee(1000000, GasPrice.fromString('1uosmo')))
            .toEqual({"amount": [{"amount": "1000000", "denom": "uosmo"}], "gas": BigInt("1000000")});
    });

    it('should estimate fees for a given network (osmosis)', async () => {
        const {chain} = await new ChainDirectory().getChainData('osmosis');
        const signer = await createSigner('osmosis');

        const message: any = {
            typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
            value: {
                delegatorAddress: 'osmo1xk23a255qm4kn6gdezr6jm7zmupn23t3mh63ya',
                validatorAddress: 'osmovaloper1xk23a255qm4kn6gdezr6jm7zmupn23t3pqjjn6',
                amount: coin('1', 'uosmo'),
            },
        };

        const signingClient = new SigningClient(Network.createFromChain(chain).data, GasPrice.fromString('0uosmo'), signer);
        expect(signingClient).toBeInstanceOf(SigningClient);

        expect(await signingClient.simulate('osmo1xk23a255qm4kn6gdezr6jm7zmupn23t3mh63ya', [message])).toBeGreaterThan(100);
    });

    it('should estimate fees for a given network (migaloo)', async () => {
        const {chain} = await new ChainDirectory().getChainData('migaloo');
        const signer = await createSigner('migaloo');

        const message: any = {
            typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
            value: {
                delegatorAddress: 'migaloo1r37anntu9wgk06jeycatp2npmytqugq54tkwju',
                validatorAddress: 'migaloovaloper1r37anntu9wgk06jeycatp2npmytqugq586jzsh',
                amount: coin('1', 'uwhale'),
            },
        };

        const signingClient = new SigningClient(Network.createFromChain(chain).data, GasPrice.fromString('0uwhale'), signer);
        expect(signingClient).toBeInstanceOf(SigningClient);

        expect(await signingClient.simulate('migaloo1r37anntu9wgk06jeycatp2npmytqugq54tkwju', [message])).toBeGreaterThan(100);
    });

    it('should be able to simulate using a fee granter', async () => {
        const {chain} = await new ChainDirectory().getChainData('osmosis');
        const signer = await createSigner('osmosis');

        const message: any = {
            typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
            value: {
                delegatorAddress: 'osmo1xk23a255qm4kn6gdezr6jm7zmupn23t3mh63ya',
                validatorAddress: 'osmovaloper1xk23a255qm4kn6gdezr6jm7zmupn23t3pqjjn6',
                amount: coin('1', 'uosmo'),
            },
        };

        const signingClient = new SigningClient(Network.createFromChain(chain).data, GasPrice.fromString('0uosmo'), signer);
        expect(signingClient).toBeInstanceOf(SigningClient);

        expect(await signingClient.simulate('osmo1xk23a255qm4kn6gdezr6jm7zmupn23t3mh63ya', [message], undefined, undefined, Fee.fromPartial({
            payer: 'osmo1xk23a255qm4kn6gdezr6jm7zmupn23t3mh63ya',
        }))).toBeGreaterThan(100);
    });
});