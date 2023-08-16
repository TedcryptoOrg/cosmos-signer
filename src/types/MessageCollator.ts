import { type Message } from './Message'

export interface MessageCollator {
  grantee: string
  messages: Message[]
}
