import { beforeEach, describe, expect, it } from "vitest";
import type { User } from "../types/User";
import { selectUser, selectUserSetupLater, userStore } from "./userStore";

describe("userStore", () => {
    beforeEach(() => {
        // Reset store to initial state before each test
        userStore.getState().clearUser();
    });

    describe("initial state", () => {
        it("should have correct initial values", () => {
            const state = userStore.getState();

            expect(state.user).toBeNull();
            expect(state.userSetupLater).toBeNull();
        });
    });

    describe("setUser", () => {
        it("should set user", () => {
            const mockUser: User = {
                _id: "user-123",
                username: "testuser",
                photo: "https://example.com/avatar.jpg",
            };

            userStore.getState().setUser(mockUser);
            expect(userStore.getState().user).toEqual(mockUser);
        });

        it("should update existing user", () => {
            const mockUser1: User = {
                _id: "user-123",
                username: "user1",
            };

            const mockUser2: User = {
                _id: "user-456",
                username: "user2",
            };

            userStore.getState().setUser(mockUser1);
            expect(userStore.getState().user).toEqual(mockUser1);

            userStore.getState().setUser(mockUser2);
            expect(userStore.getState().user).toEqual(mockUser2);
        });

        it("should clear user when null", () => {
            const mockUser: User = {
                _id: "user-123",
                username: "testuser",
            };

            userStore.getState().setUser(mockUser);
            userStore.getState().setUser(null);
            expect(userStore.getState().user).toBeNull();
        });

        it("should work with selector", () => {
            const mockUser: User = {
                _id: "user-123",
                username: "testuser",
            };

            userStore.getState().setUser(mockUser);
            expect(selectUser(userStore.getState())).toEqual(mockUser);
        });
    });

    describe("setUserSetupLater", () => {
        it("should set userSetupLater to true", () => {
            userStore.getState().setUserSetupLater(true);
            expect(userStore.getState().userSetupLater).toBe(true);
        });

        it("should set userSetupLater to false", () => {
            userStore.getState().setUserSetupLater(true);
            userStore.getState().setUserSetupLater(false);
            expect(userStore.getState().userSetupLater).toBe(false);
        });

        it("should clear userSetupLater when null", () => {
            userStore.getState().setUserSetupLater(true);
            userStore.getState().setUserSetupLater(null);
            expect(userStore.getState().userSetupLater).toBeNull();
        });

        it("should work with selector", () => {
            userStore.getState().setUserSetupLater(true);
            expect(selectUserSetupLater(userStore.getState())).toBe(true);
        });
    });

    describe("clearUser", () => {
        it("should clear all user data", () => {
            const mockUser: User = {
                _id: "user-123",
                username: "testuser",
            };

            // Set values
            userStore.getState().setUser(mockUser);
            userStore.getState().setUserSetupLater(true);

            // Clear
            userStore.getState().clearUser();

            // Verify all cleared
            const state = userStore.getState();
            expect(state.user).toBeNull();
            expect(state.userSetupLater).toBeNull();
        });

        it("should clear only user when userSetupLater was not set", () => {
            const mockUser: User = {
                _id: "user-123",
                username: "testuser",
            };

            userStore.getState().setUser(mockUser);
            userStore.getState().clearUser();

            const state = userStore.getState();
            expect(state.user).toBeNull();
            expect(state.userSetupLater).toBeNull();
        });
    });

    describe("selectors", () => {
        it("should select correct values from state", () => {
            const mockUser: User = {
                _id: "user-123",
                username: "testuser",
                photo: "https://example.com/avatar.jpg",
            };

            userStore.getState().setUser(mockUser);
            userStore.getState().setUserSetupLater(true);

            const state = userStore.getState();

            expect(selectUser(state)).toEqual(mockUser);
            expect(selectUserSetupLater(state)).toBe(true);
        });

        it("should return null for unset values", () => {
            const state = userStore.getState();

            expect(selectUser(state)).toBeNull();
            expect(selectUserSetupLater(state)).toBeNull();
        });
    });

    describe("user profile updates", () => {
        it("should handle partial user updates", () => {
            const mockUser: User = {
                _id: "user-123",
                username: "testuser",
            };

            userStore.getState().setUser(mockUser);

            const updatedUser: User = {
                ...mockUser,
                username: "updateduser",
            };

            userStore.getState().setUser(updatedUser);
            expect(userStore.getState().user?.username).toBe("updateduser");
        });

        it("should handle user with all fields", () => {
            const completeUser: User = {
                _id: "user-123",
                username: "testuser",
                photo: "https://example.com/avatar.jpg",
            };

            userStore.getState().setUser(completeUser);
            expect(userStore.getState().user).toEqual(completeUser);
        });
    });
});
