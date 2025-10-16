import type { SsoMetadata } from "@frak-labs/core-sdk";
import { atom } from "jotai";
import type { Hex } from "viem";

type SsoContext = {
    productId?: string;
    redirectUrl?: string;
    directExit?: boolean;
    metadata?: AppSpecificSsoMetadata;
    id?: Hex;
};

/**
 * Atom to store the SSO context
 */
export const ssoContextAtom = atom<SsoContext | null>(null);

export type AppSpecificSsoMetadata = SsoMetadata & {
    name: string;
    css?: string;
};

/**
 * Get the current sso metadata
 */
export const currentSsoMetadataAtom = atom(
    (get) => get(ssoContextAtom)?.metadata
);
