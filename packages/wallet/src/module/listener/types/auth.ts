import type {
    AuthenticateReturnType,
    SiweAuthenticationParams,
} from "@frak-labs/nexus-sdk/core";

export type SiweAuthenticateListenerParam = {
    siweMessage: SiweAuthenticationParams;
    context?: string;
    emitter: (response: AuthenticateReturnType) => Promise<void>;
};
