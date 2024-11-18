import {Chain, ChainDirectory} from "@tedcryptoorg/cosmos-directory";
import {DefaultAdapter, Network, NetworkData, SigningClient} from "../../src";
import OfflineWallet from "../../src/Wallet/OfflineWallet";
import {GasPrice} from "@cosmjs/stargate";

export const TEST_MNEMONIC = 'online lottery matter blanket couple recall scorpion fat jungle student balance way angle upon title gap teach video farm skirt despair mesh cliff field';

export async function fixedChainData(chainName?: string): Promise<Chain> {
    return (await new ChainDirectory().getChainData(chainName ?? 'osmosis')).chain;
}

export function createOfflineWallet(): OfflineWallet {
    return new OfflineWallet(TEST_MNEMONIC);
}

export async function fixedNetworkData(chainName?: string): Promise<NetworkData> {
    return (await Network.createFromChain(await fixedChainData(chainName))).data
}

export async function createDefaultAdapter(chainName?: string): Promise<DefaultAdapter> {
    return new DefaultAdapter(
        await fixedNetworkData(chainName),
        createOfflineWallet()
    )
}

export async function fixedSignedClient(chainName?: string): Promise<SigningClient> {
    return new SigningClient(
        await fixedNetworkData(chainName),
        createOfflineWallet(),
        GasPrice.fromString('0uosmo')
    )
}