import type { SsoMetadata } from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type SsoContext = {
    redirectUrl?: string;
    directExit?: boolean;
};

/**
 * Atom to store the SSO context
 */
export const ssoContextAtom = atom<SsoContext | null>(null);

export type AppSpecificSsoMetadata = SsoMetadata & {
    name: string;
    css?: string;
};

type AppMetadatas = Record<string, AppSpecificSsoMetadata>;

/**
 * The atom for the current sso metadata
 */
export const ssoMetadataAtom = atomWithStorage<AppMetadatas>("ssoMetadata", {});
