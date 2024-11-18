import moment from 'moment'
import {GenericAuthorization} from "cosmjs-types/cosmos/authz/v1beta1/authz.js";
import {StakeAuthorization} from "cosmjs-types/cosmos/staking/v1beta1/authz.js";
import type {Registry} from "@cosmjs/proto-signing";
import type {AminoTypes} from "@cosmjs/stargate";

function createAuthzAuthorizationAminoConverter() {
    return {
        "/cosmos.authz.v1beta1.GenericAuthorization": {
            aminoType: "cosmos-sdk/GenericAuthorization",
            toAmino: (value: Uint8Array) => GenericAuthorization.decode(value),
            fromAmino: ({msg}: { msg: any }) => (GenericAuthorization.encode(GenericAuthorization.fromPartial({
                msg
            })).finish())
        },
        "/cosmos.staking.v1beta1.StakeAuthorization": {
            aminoType: "cosmos-sdk/StakeAuthorization",
            toAmino: (value: Uint8Array) => {
                const {allowList, maxTokens, authorizationType} = StakeAuthorization.decode(value)
                return {
                    Validators: {
                        type: "cosmos-sdk/StakeAuthorization/AllowList",
                        value: {
                            allow_list: allowList
                        }
                    },
                    max_tokens: maxTokens,
                    authorization_type: authorizationType
                }
            },
            fromAmino: ({allow_list, max_tokens, authorization_type}: {
                allow_list?: any,
                max_tokens?: any,
                authorization_type?: any
            }) => (StakeAuthorization.encode(StakeAuthorization.fromPartial({
                allowList: allow_list,
                maxTokens: max_tokens,
                authorizationType: authorization_type
            })).finish())
        }
    }
}

const dateConverter = {
    toAmino(date: { seconds: number, nanos: number }) {
        return moment(Number(date.seconds) * 1000).utc().format()
    },
    fromAmino(date: Date) {
        return {
            seconds: moment(date).unix(),
            nanos: 0
        }
    }
}

export function createAuthzAminoConverters() {
    const grantConverter = createAuthzAuthorizationAminoConverter() as any
    return {
        "/cosmos.authz.v1beta1.MsgGrant": {
            aminoType: "cosmos-sdk/MsgGrant",
            toAmino: ({granter, grantee, grant}: { granter?: any, grantee?: any, grant?: any }) => {
                const converter = grantConverter[grant.authorization.typeUrl]
                return {
                    granter,
                    grantee,
                    grant: {
                        authorization: {
                            type: converter.aminoType,
                            value: converter.toAmino(grant.authorization.value)
                        },
                        expiration: dateConverter.toAmino(grant.expiration)
                    }
                }
            },
            fromAmino: ({granter, grantee, grant}: { granter?: any, grantee?: any, grant?: any }) => {
                const protoType = Object.keys(grantConverter).find(type => grantConverter[type].aminoType === grant.authorization.type) as any
                const converter = grantConverter[protoType]
                return {
                    granter,
                    grantee,
                    grant: {
                        authorization: {
                            typeUrl: protoType,
                            value: converter.fromAmino(grant.authorization.value)
                        },
                        expiration: dateConverter.fromAmino(grant.expiration)
                    }
                }
            },
        },
        "/cosmos.authz.v1beta1.MsgRevoke": {
            aminoType: "cosmos-sdk/MsgRevoke",
            toAmino: ({granter, grantee, msgTypeUrl}: any) => ({
                granter,
                grantee,
                msg_type_url: msgTypeUrl
            }),
            fromAmino: ({granter, grantee, msg_type_url}: any) => ({
                granter,
                grantee,
                msgTypeUrl: msg_type_url
            }),
        },
    };
}

export function createAuthzExecAminoConverters(registry: Registry, aminoTypes: AminoTypes) {
    return {
        "/cosmos.authz.v1beta1.MsgExec": {
            aminoType: "cosmos-sdk/MsgExec",
            toAmino: ({grantee, msgs}: any) => ({
                grantee,
                msgs: msgs.map(({typeUrl, value}: any) => {
                    const msgType = registry.lookupType(typeUrl)
                    if (msgType === undefined) {
                        throw new Error(`No message type registered for ${typeUrl}`)
                    }

                    return aminoTypes.toAmino({typeUrl, value: msgType.decode(value)})
                })
            }),
            fromAmino: ({grantee, msgs}: any) => ({
                grantee,
                msgs: msgs.map(({type, value}: any) => {
                    const proto = aminoTypes.fromAmino({type, value})
                    const {typeUrl} = proto
                    const msgType = registry.lookupType(typeUrl) as any
                    if (msgType === undefined) {
                        throw new Error(`No message type registered for ${typeUrl}`)
                    }

                    return {
                        typeUrl,
                        value: msgType.encode(msgType.fromPartial(proto.value)).finish()
                    }
                })
            }),
        },
    };
}
