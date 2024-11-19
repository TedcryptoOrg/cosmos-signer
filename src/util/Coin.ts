import {type Coin, coin as _coin} from '@cosmjs/stargate'
import BigNumber from 'bignumber.js';

export function coin(amount: any, denom: string): Coin {
    return _coin(
        new BigNumber(amount).integerValue(BigNumber.ROUND_FLOOR).toFixed(),
        denom
    )
}