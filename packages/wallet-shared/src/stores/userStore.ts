/**
 * Zustand store for user management
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserStore } from "./types";

/**
 * User store managing user profile and setup preferences
 * Uses persist middleware to sync with localStorage
 */
export const userStore = create<UserStore>()(
    persist(
        (set) => ({
            // Initial state
            user: null,
            userSetupLater: null,

            // Actions
            setUser: (user) => set({ user }),
            setUserSetupLater: (userSetupLater) => set({ userSetupLater }),
            clearUser: () =>
                set({
                    user: null,
                    userSetupLater: null,
                }),
        }),
        {
            name: "frak_user_store",
            partialize: (state) => ({
                user: state.user,
                userSetupLater: state.userSetupLater,
            }),
        }
    )
);

/**
 * Selector functions for computed values
 */

// Get the current user
export const selectUser = (state: UserStore) => state.user;

// Get user setup later preference
export const selectUserSetupLater = (state: UserStore) => state.userSetupLater;
