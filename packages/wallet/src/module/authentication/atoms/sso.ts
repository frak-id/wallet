import type { SsoMetadata } from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";

type SsoContext = {
    productId?: string;
    redirectUrl?: string;
    directExit?: boolean;
    metadata?: AppSpecificSsoMetadata;
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
