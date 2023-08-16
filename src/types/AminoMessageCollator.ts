import { type AminoMsg } from '@cosmjs/amino'

export interface AminoMessageCollator {
  grantee: string
  messages: AminoMsg[]
}
