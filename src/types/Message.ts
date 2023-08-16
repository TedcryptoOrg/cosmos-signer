import type protobuf from 'protobufjs'

export interface Message {
  typeUrl: string
  value: protobuf.Reader | Uint8Array
}
