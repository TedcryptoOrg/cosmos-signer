import {ChainDirectory} from "@tedcryptoorg/cosmos-directory";
import {SigningClient} from "../../src";
import {GasPrice} from "@cosmjs/stargate";

describe('SigningClient', () => {
    it('should be able to create a signing client from a chain directory', async () => {
        const chain = (await new ChainDirectory().getChainData('osmosis')).chain;
        const signer = {};

        const signingClient = await SigningClient.createWithChain(chain, GasPrice.fromString('0uosmo'), signer);
        expect(signingClient).toBeInstanceOf(SigningClient);
        expect(signingClient.calculateFee(1000000, GasPrice.fromString('0uosmo'))).toEqual({"amount": [{"amount": "0", "denom": "uosmo"}], "gas": "1000000"});
        expect(signingClient.calculateFee(1000000, GasPrice.fromString('1uosmo'))).toEqual({"amount": [{"amount": "1000000", "denom": "uosmo"}], "gas": "1000000"});
    })
});