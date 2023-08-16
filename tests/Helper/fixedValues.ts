import {ChainDirectory} from "@tedcryptoorg/cosmos-directory";
import {Signer} from "../../src";

export const TEST_MNEMONIC: string = 'online lottery matter blanket couple recall scorpion fat jungle student balance way angle upon title gap teach video farm skirt despair mesh cliff field';

export async function createSigner(name: string): Promise<Signer> {
    const chain = (await new ChainDirectory().getChainData(name)).chain;

    return Signer.createSigner(chain, TEST_MNEMONIC);
}