import { coin as _coin } from  '@cosmjs/stargate'
const mathjs = require('mathjs')

export function coin(amount: any, denom: string){
    return _coin(mathjs.format(mathjs.floor(amount), {notation: 'fixed'}), denom)
}