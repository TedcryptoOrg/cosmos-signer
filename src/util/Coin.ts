import { type Coin, coin as _coin } from '@cosmjs/stargate'
import * as mathjs from 'mathjs'

export function coin (amount: any, denom: string): Coin {
  return _coin(
    mathjs.format(mathjs.floor(amount), { notation: 'fixed' }) as string | number,
    denom
  )
}