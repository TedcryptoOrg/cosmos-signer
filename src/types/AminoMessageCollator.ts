import {AminoMsg} from "@cosmjs/amino";

export type AminoMessageCollator = {
    grantee: string,
    messages: AminoMsg[]
}