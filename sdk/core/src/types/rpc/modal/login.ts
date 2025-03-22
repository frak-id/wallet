import type { Address } from "viem";
import type { SsoMetadata } from "../sso";
import type { GenericModalStepType } from "./generic";

/** @inline */
type LoginWithSso = {
    allowSso: true;
    // Optional metadata for the SSO (if not provided, will be recomputed from the top level wallet sdk)
    ssoMetadata?: SsoMetadata;
};

/** @inline */
type LoginWithoutSso = {
    allowSso?: false;
    ssoMetadata?: never;
};

/**
 * The login step for a Modal
 *
 * **Input**: Do we allow SSO or not? Is yes then the SSO metadata
 * **Output**: The logged in wallet address
 *
 * @group Modal Display
 */
export type LoginModalStepType = GenericModalStepType<
    "login",
    LoginWithSso | LoginWithoutSso,
    {
        wallet: Address;
    }
>;
