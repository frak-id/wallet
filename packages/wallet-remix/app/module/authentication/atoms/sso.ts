import type { SsoMetadata } from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
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

export const ssoConsumeKey = atomWithStorage<{
    key: Hex;
    generatedAt: number;
} | null>("frak_ssoConsumeKey", null);
