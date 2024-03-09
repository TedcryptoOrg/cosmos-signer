import { type Coin, coin as _coin } from '@cosmjs/stargate'
const mathjs = require('mathjs')

export function coin (amount: any, denom: string): Coin {
  return _coin(
    mathjs.format(mathjs.floor(amount), { notation: 'fixed' }) as string | number,
    denom
  )
}
