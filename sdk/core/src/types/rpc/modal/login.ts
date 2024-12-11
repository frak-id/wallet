import type { Address } from "viem";
import type { SsoMetadata } from "../sso";
import type { GenericModalStepType } from "./generic";

type LoginWithSso = {
    allowSso: true;
    ssoMetadata: SsoMetadata;
};

type LoginWithoutSso = {
    allowSso?: false;
    ssoMetadata?: never;
};

/**
 * Generic type of modal we will display to the end user
 */
export type LoginModalStepType = GenericModalStepType<
    "login",
    LoginWithSso | LoginWithoutSso,
    {
        wallet: Address;
    }
>;
