import protobuf from "protobufjs";

export type Message = {
    typeUrl: string,
    value: protobuf.Reader|Uint8Array,
}
