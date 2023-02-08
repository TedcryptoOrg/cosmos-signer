import {defaultRegistryTypes as defaultStargateTypes} from "@cosmjs/stargate/build/signingstargateclient";
import {Registry as DefaultRegistry} from "@cosmjs/proto-signing";

export class Registry {
    private readonly registry: DefaultRegistry;

    constructor() {
        this.registry = new DefaultRegistry(defaultStargateTypes);
    }

    public getProtoSigningRegistry(): DefaultRegistry {
        return this.registry;
    }
}

export const registry = new Registry();