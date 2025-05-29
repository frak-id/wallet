import { atom } from "jotai";

/**
 * Atom to track if the in-app browser toast has been dismissed during the current session
 */
export const inAppBrowserToastDismissedAtom = atom(false);

/**
 * Atom to track if a social redirect has been attempted during the current session
 */
export const socialRedirectAttemptedAtom = atom(false);
