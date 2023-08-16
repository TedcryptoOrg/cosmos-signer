import {TEST_MNEMONIC} from "../../Helper/fixedValues";
import {ChainDirectory} from "@tedcryptoorg/cosmos-directory";
import {Network} from "../../../src/Network";
import {Signer} from "../../../src/Signers/Signer";

describe('EthSigner', () => {
    it('should be able to create and get the right address', async () => {
        const network = Network.createFromChain((await new ChainDirectory().getChainData('evmos')).chain);
        const ethSigner = await Signer.createSigner(network.data, TEST_MNEMONIC);

        expect(await ethSigner.getAddress()).toEqual('evmos1va984xzrrznkugjapt6wpklwwr0psfvph6kqr3');
    })
})