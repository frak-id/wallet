import type {
    SiweAuthenticateReturnType,
    SiweAuthenticationParams,
} from "@frak-labs/nexus-sdk/core";

export type SiweAuthenticateListenerParam = {
    siweMessage: SiweAuthenticationParams;
    context?: string;
    emitter: (response: SiweAuthenticateReturnType) => Promise<void>;
};
