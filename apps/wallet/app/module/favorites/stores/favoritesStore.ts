import { trackEvent } from "@frak-labs/wallet-shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type FavoritesState = {
    /** Favorited merchant ids, kept as a map for O(1) lookups. */
    favorites: Record<string, true>;
};

type FavoritesActions = {
    toggleFavorite: (merchantId: string) => void;
};

/**
 * Persists the brands a user has favorited from the Explorer. Frontend-only for
 * now (no backend sync), so the map lives in localStorage keyed by merchant id.
 */
export const favoritesStore = create<FavoritesState & FavoritesActions>()(
    persist(
        (set, get) => ({
            favorites: {},
            toggleFavorite: (merchantId) => {
                const isRemoving = Boolean(get().favorites[merchantId]);
                set((state) => {
                    const next = { ...state.favorites };
                    if (isRemoving) {
                        delete next[merchantId];
                    } else {
                        next[merchantId] = true;
                    }
                    return { favorites: next };
                });
                // Keep tracking out of the set() updater (see modalStore).
                trackEvent("favorite_toggled", {
                    merchant_id: merchantId,
                    action: isRemoving ? "remove" : "add",
                });
            },
        }),
        {
            name: "frak_favorites_store",
            partialize: (state) => ({ favorites: state.favorites }),
        }
    )
);

/** Selector factory: true when the given merchant is favorited. */
export const selectIsFavorite =
    (merchantId: string) => (state: FavoritesState) =>
        Boolean(state.favorites[merchantId]);

/**
 * Returns the stable favorites map. Prefer this over deriving an array in the
 * selector: a fresh `Object.keys` reference on every call makes `useStore`
 * (useSyncExternalStore) loop forever. Derive ids/sets in a `useMemo` instead.
 */
export const selectFavorites = (state: FavoritesState) => state.favorites;
