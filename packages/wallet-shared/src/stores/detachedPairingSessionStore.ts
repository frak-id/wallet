/**
 * Tab-scoped Zustand store for the "detached" pairing session used by the
 * cross-device wallet merge flow.
 *
 * Why a separate store from `sessionStore`:
 *  - The merge flow needs to hold a second authenticated identity (the
 *    pairing credential) without disturbing the user's live wallet session.
 *  - Backed by `sessionStorage` rather than `localStorage` so the slot is
 *    scoped to the active tab, survives refreshes mid-merge, but dies when
 *    the tab closes. Aligns with the lifetime of the in-flight pairing
 *    state already persisted by `OriginPairingClient`.
 */

import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { DetachedPairingSessionStore } from "./types";

/**
 * sessionStorage adapter that no-ops in non-browser contexts (SSR, tests
 * without jsdom). Mirrors the safety dance other persisted stores use.
 */
const safeSessionStorage = createJSONStorage(() => {
    if (typeof window === "undefined") {
        return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
        };
    }
    return window.sessionStorage;
});

export const detachedPairingSessionStore =
    createStore<DetachedPairingSessionStore>()(
        persist(
            (set) => ({
                detached: null,
                setDetachedSession: (detached) => set({ detached }),
                clearDetachedSession: () => set({ detached: null }),
            }),
            {
                name: "frak_detached_pairing_session",
                storage: safeSessionStorage,
                partialize: (state) => ({ detached: state.detached }),
            }
        )
    );
