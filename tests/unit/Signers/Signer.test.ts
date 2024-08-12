import {createSigner} from "../../Helper/fixedValues";

jest.setTimeout(30000)
jest.retryTimes(3)

describe('Signer', () => {
    it('should be able to create and get the right address for cosmos chains', async () => {
        const signer = await createSigner('osmosis');

        expect(await signer.getAddress()).toEqual('osmo1dkn5h078g3g2fzhd2us2t4smh87atd8pyg5xy3');
        expect((await signer.getAccounts()).length).toEqual(1);
    })

    it('should be able to create and get the right address for eth chains', async () => {
        const signer = await createSigner('evmos');

        expect(await signer.getAddress()).toEqual('evmos1va984xzrrznkugjapt6wpklwwr0psfvph6kqr3');
        expect((await signer.getAccounts()).length).toEqual(1);
    });
})