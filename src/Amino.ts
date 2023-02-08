import {Message} from "./types/Message";
import {Network} from "./types/Network";
import {
    AminoTypes,
    createBankAminoConverters,
    createDistributionAminoConverters,
    createFeegrantAminoConverters,
    createGovAminoConverters, createIbcAminoConverters,
    createStakingAminoConverters
} from "@cosmjs/stargate";
import {AminoMessageCollator} from "./types/AminoMessageCollator";
import {AminoMsg} from "@cosmjs/amino";
import {MessageCollator} from "./types/MessageCollator";
import moment from "moment/moment";
import {GenericAuthorization} from "cosmjs-types/cosmos/authz/v1beta1/authz";
import {StakeAuthorization} from "cosmjs-types/cosmos/staking/v1beta1/authz";
import {Registry} from "@cosmjs/proto-signing";

export class Amino {
    private aminoTypes: AminoTypes
    private network: Network

    constructor(network: Network) {
        const registry = require('./Registry').registry.getProtoSigningRegistry();
        this.network = network;

        const defaultConverters = {
            ...this.createAuthzAminoConverters(),
            ...createBankAminoConverters(),
            ...createDistributionAminoConverters(),
            ...createGovAminoConverters(),
            ...createStakingAminoConverters(network.prefix),
            ...createIbcAminoConverters(),
            ...createFeegrantAminoConverters(),
        }
        let aminoTypes = new AminoTypes(defaultConverters)
        this.aminoTypes = new AminoTypes({...defaultConverters, ...this.createAuthzExecAminoConverters(registry, aminoTypes)})
    }

    convertToAmino(messages: Message[]){
        return messages.map(message => {
            if(message.typeUrl.startsWith('/cosmos.authz') && !this.network.authzAminoSupport){
                throw new Error('This chain does not support amino conversion for Authz messages')
            }
            return this.aminoTypes.toAmino(message)
        })
    }

    createAuthzAuthorizationAminoConverter(): any {
        return {
            "/cosmos.authz.v1beta1.GenericAuthorization": {
                aminoType: "cosmos-sdk/GenericAuthorization",
                toAmino: (value: any) => GenericAuthorization.decode(value),
                fromAmino: ({ msg }: any) => (GenericAuthorization.encode(GenericAuthorization.fromPartial({
                    msg
                })).finish())
            },
            "/cosmos.staking.v1beta1.StakeAuthorization": {
                aminoType: "cosmos-sdk/StakeAuthorization",
                toAmino: (value: any) => {
                    const { allowList, maxTokens, authorizationType } = StakeAuthorization.decode(value)
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
                fromAmino: ({ allow_list, max_tokens, authorization_type }: any) => (StakeAuthorization.encode(StakeAuthorization.fromPartial({
                    allowList: allow_list,
                    maxTokens: max_tokens,
                    authorizationType: authorization_type
                })).finish())
            }
        }
    }

    convertDateToAmino(date: any): string {
        return moment(date.seconds.toNumber() * 1000).utc().format()
    }

    convertDateFromAmino(date: any): Object {
        return {
            seconds: moment(date).unix(),
            nanos: 0
        }
    }

    createAuthzAminoConverters() {
        const grantConverter = this.createAuthzAuthorizationAminoConverter()
        return {
            "/cosmos.authz.v1beta1.MsgGrant": {
                aminoType: "cosmos-sdk/MsgGrant",
                toAmino: ({ granter, grantee, grant }: any) => {
                    const converter = grantConverter[grant.authorization.typeUrl]
                    return {
                        granter,
                        grantee,
                        grant: {
                            authorization: {
                                type: converter.aminoType,
                                value: converter.toAmino(grant.authorization.value)
                            },
                            expiration: this.convertDateToAmino(grant.expiration)
                        }
                    }
                },
                fromAmino: ({ granter, grantee, grant }: any) => {
                    const protoType = Object.keys(grantConverter).find(type => grantConverter[type].aminoType === grant.authorization.type)
                    if (!protoType) {
                        throw new Error(`Unsupported authorization type: ${grant.authorization.type}`)
                    }
                    const converter = grantConverter[protoType]
                    return {
                        granter,
                        grantee,
                        grant: {
                            authorization: {
                                typeUrl: protoType,
                                value: converter.fromAmino(grant.authorization.value)
                            },
                            expiration: this.convertDateFromAmino(grant.expiration)
                        }
                    }
                },
            },
            "/cosmos.authz.v1beta1.MsgRevoke": {
                aminoType: "cosmos-sdk/MsgRevoke",
                toAmino: ({ granter, grantee, msgTypeUrl }: any) => ({
                    granter,
                    grantee,
                    msg_type_url: msgTypeUrl
                }),
                fromAmino: ({ granter, grantee, msg_type_url }: any) => ({
                    granter,
                    grantee,
                    msgTypeUrl: msg_type_url
                }),
            },
        };
    }

    createAuthzExecAminoConverters(registry: Registry, aminoTypes: AminoTypes) {
        return {
            "/cosmos.authz.v1beta1.MsgExec": {
                aminoType: "cosmos-sdk/MsgExec",
                toAmino: ({ grantee, messages }: MessageCollator) => ({
                    grantee,
                    messages: messages.map(({typeUrl, value}: Message) => {
                        const msgType = registry.lookupType(typeUrl)
                        if (!msgType) {
                            throw new Error(`Cannot convert message type ${typeUrl} to amino`);
                        }

                        return aminoTypes.toAmino({ typeUrl, value: msgType.decode(value) })
                    })
                }),
                fromAmino: ({ grantee, messages }: AminoMessageCollator) => ({
                    grantee,
                    messages: messages.map(({type, value}: AminoMsg) => {
                        const proto = aminoTypes.fromAmino({ type, value })
                        const typeUrl = proto.typeUrl
                        const msgType = registry.lookupType(typeUrl)
                        if (!msgType) {
                            throw new Error(`Cannot convert message type ${typeUrl} from amino`);
                        }

                        return {
                            typeUrl,
                            // @ts-ignore
                            value: msgType.encode(msgType.fromPartial(proto.value)).finish()
                        }
                    })
                }),
            },
        };
    }
}