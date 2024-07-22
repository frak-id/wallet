import { atom } from "jotai";

export type SsoContext = {
    redirectUrl?: string;
    directExit?: boolean;
};

/**
 * Atom to store the SSO context
 */
export const ssoContextAtom = atom<SsoContext | null>(null);
