import type {
    RecoveryFileContent,
    WebAuthNWallet,
} from "@frak-labs/wallet-shared";
import type { LocalAccount } from "viem";
import {
    selectRecoveryFileContent,
    selectRecoveryGuardianAccount,
    selectRecoveryNewWallet,
    selectRecoveryOptions,
    selectRecoveryPassword,
    selectRecoveryStep,
} from "@/module/stores/recoveryStore";
import { describe, expect, test } from "@/tests/vitest-fixtures";

describe("recoveryStore", () => {
    describe("initial state", () => {
        test("should have correct initial values", ({ freshRecoveryStore }) => {
            const state = freshRecoveryStore.getState();

            expect(state.step).toBe(1);
            expect(state.password).toBeUndefined();
            expect(state.options).toBeUndefined();
            expect(state.fileContent).toBeNull();
            expect(state.guardianAccount).toBeNull();
            expect(state.newWallet).toBeNull();
        });
    });

    describe("setStep", () => {
        test("should update the step", ({ freshRecoveryStore }) => {
            freshRecoveryStore.getState().setStep(2);
            expect(freshRecoveryStore.getState().step).toBe(2);

            freshRecoveryStore.getState().setStep(4);
            expect(freshRecoveryStore.getState().step).toBe(4);
        });

        test("should work with selector", ({ freshRecoveryStore }) => {
            freshRecoveryStore.getState().setStep(3);
            expect(selectRecoveryStep(freshRecoveryStore.getState())).toBe(3);
        });
    });

    describe("setPassword", () => {
        test("should set password", ({ freshRecoveryStore }) => {
            freshRecoveryStore.getState().setPassword("test-password-123");
            expect(freshRecoveryStore.getState().password).toBe(
                "test-password-123"
            );
        });

        test("should clear password when undefined", ({
            freshRecoveryStore,
        }) => {
            freshRecoveryStore.getState().setPassword("test-password");
            freshRecoveryStore.getState().setPassword(undefined);
            expect(freshRecoveryStore.getState().password).toBeUndefined();
        });

        test("should work with selector", ({ freshRecoveryStore }) => {
            freshRecoveryStore.getState().setPassword("my-password");
            expect(selectRecoveryPassword(freshRecoveryStore.getState())).toBe(
                "my-password"
            );
        });
    });

    describe("setOptions", () => {
        test("should set recovery options", ({ freshRecoveryStore }) => {
            const mockOptions = {
                setupTxData: "0x123abc" as `0x${string}`,
                file: {
                    initialWallet: { address: "0xWallet" },
                    guardianAddress: "0xGuardian",
                } as unknown as RecoveryFileContent,
            };

            freshRecoveryStore.getState().setOptions(mockOptions);
            expect(freshRecoveryStore.getState().options).toEqual(mockOptions);
        });

        test("should clear options when undefined", ({
            freshRecoveryStore,
        }) => {
            const mockOptions = {
                setupTxData: "0x123abc" as `0x${string}`,
                file: {} as unknown as RecoveryFileContent,
            };

            freshRecoveryStore.getState().setOptions(mockOptions);
            freshRecoveryStore.getState().setOptions(undefined);
            expect(freshRecoveryStore.getState().options).toBeUndefined();
        });

        test("should work with selector", ({ freshRecoveryStore }) => {
            const mockOptions = {
                setupTxData: "0x123abc" as `0x${string}`,
                file: {} as unknown as RecoveryFileContent,
            };

            freshRecoveryStore.getState().setOptions(mockOptions);
            expect(
                selectRecoveryOptions(freshRecoveryStore.getState())
            ).toEqual(mockOptions);
        });
    });

    describe("setFileContent", () => {
        test("should set file content", ({ freshRecoveryStore }) => {
            const mockFile: RecoveryFileContent = {
                initialWallet: { address: "0xWallet" },
                guardianAddress: "0xGuardian",
                guardianPrivateKeyEncrypted: "encrypted-data",
            } as unknown as RecoveryFileContent;

            freshRecoveryStore.getState().setFileContent(mockFile);
            expect(freshRecoveryStore.getState().fileContent).toEqual(mockFile);
        });

        test("should clear file content when null", ({
            freshRecoveryStore,
        }) => {
            const mockFile = {} as unknown as RecoveryFileContent;

            freshRecoveryStore.getState().setFileContent(mockFile);
            freshRecoveryStore.getState().setFileContent(null);
            expect(freshRecoveryStore.getState().fileContent).toBeNull();
        });

        test("should work with selector", ({ freshRecoveryStore }) => {
            const mockFile = {} as unknown as RecoveryFileContent;

            freshRecoveryStore.getState().setFileContent(mockFile);
            expect(
                selectRecoveryFileContent(freshRecoveryStore.getState())
            ).toEqual(mockFile);
        });
    });

    describe("setGuardianAccount", () => {
        test("should set guardian account", ({ freshRecoveryStore }) => {
            const mockAccount = {
                address: "0xGuardian",
                signMessage: () => {},
            } as unknown as LocalAccount;

            freshRecoveryStore.getState().setGuardianAccount(mockAccount);
            expect(freshRecoveryStore.getState().guardianAccount).toEqual(
                mockAccount
            );
        });

        test("should clear guardian account when null", ({
            freshRecoveryStore,
        }) => {
            const mockAccount = {
                address: "0xGuardian",
            } as unknown as LocalAccount;

            freshRecoveryStore.getState().setGuardianAccount(mockAccount);
            freshRecoveryStore.getState().setGuardianAccount(null);
            expect(freshRecoveryStore.getState().guardianAccount).toBeNull();
        });

        test("should work with selector", ({ freshRecoveryStore }) => {
            const mockAccount = {
                address: "0xGuardian",
            } as unknown as LocalAccount;

            freshRecoveryStore.getState().setGuardianAccount(mockAccount);
            expect(
                selectRecoveryGuardianAccount(freshRecoveryStore.getState())
            ).toEqual(mockAccount);
        });
    });

    describe("setNewWallet", () => {
        test("should set new wallet", ({ freshRecoveryStore }) => {
            const mockWallet = {
                address: "0xNewWallet",
                authenticatorId: "auth-123",
            } as unknown as WebAuthNWallet;

            freshRecoveryStore.getState().setNewWallet(mockWallet);
            expect(freshRecoveryStore.getState().newWallet).toEqual(mockWallet);
        });

        test("should clear new wallet when null", ({ freshRecoveryStore }) => {
            const mockWallet = {
                address: "0xNewWallet",
            } as unknown as WebAuthNWallet;

            freshRecoveryStore.getState().setNewWallet(mockWallet);
            freshRecoveryStore.getState().setNewWallet(null);
            expect(freshRecoveryStore.getState().newWallet).toBeNull();
        });

        test("should work with selector", ({ freshRecoveryStore }) => {
            const mockWallet = {
                address: "0xNewWallet",
            } as unknown as WebAuthNWallet;

            freshRecoveryStore.getState().setNewWallet(mockWallet);
            expect(
                selectRecoveryNewWallet(freshRecoveryStore.getState())
            ).toEqual(mockWallet);
        });
    });

    describe("reset", () => {
        test("should reset all state to initial values", ({
            freshRecoveryStore,
        }) => {
            // Set various state values
            freshRecoveryStore.getState().setStep(3);
            freshRecoveryStore.getState().setPassword("test-pass");
            freshRecoveryStore.getState().setOptions({
                setupTxData: "0xabc" as `0x${string}`,
                file: {} as unknown as RecoveryFileContent,
            });
            freshRecoveryStore
                .getState()
                .setFileContent({} as unknown as RecoveryFileContent);
            freshRecoveryStore
                .getState()
                .setGuardianAccount({} as unknown as LocalAccount);
            freshRecoveryStore
                .getState()
                .setNewWallet({} as unknown as WebAuthNWallet);

            // Reset
            freshRecoveryStore.getState().reset();

            // Verify all values are back to initial state
            const state = freshRecoveryStore.getState();
            expect(state.step).toBe(1);
            expect(state.password).toBeUndefined();
            expect(state.options).toBeUndefined();
            expect(state.fileContent).toBeNull();
            expect(state.guardianAccount).toBeNull();
            expect(state.newWallet).toBeNull();
        });
    });

    describe("selectors", () => {
        test("should select correct values from state", ({
            freshRecoveryStore,
        }) => {
            const mockFile = {} as unknown as RecoveryFileContent;
            const mockAccount = {
                address: "0xGuardian",
            } as unknown as LocalAccount;
            const mockWallet = {
                address: "0xWallet",
            } as unknown as WebAuthNWallet;
            const mockOptions = {
                setupTxData: "0xabc" as `0x${string}`,
                file: mockFile,
            };

            freshRecoveryStore.getState().setStep(2);
            freshRecoveryStore.getState().setPassword("password");
            freshRecoveryStore.getState().setOptions(mockOptions);
            freshRecoveryStore.getState().setFileContent(mockFile);
            freshRecoveryStore.getState().setGuardianAccount(mockAccount);
            freshRecoveryStore.getState().setNewWallet(mockWallet);

            const state = freshRecoveryStore.getState();

            expect(selectRecoveryStep(state)).toBe(2);
            expect(selectRecoveryPassword(state)).toBe("password");
            expect(selectRecoveryOptions(state)).toEqual(mockOptions);
            expect(selectRecoveryFileContent(state)).toEqual(mockFile);
            expect(selectRecoveryGuardianAccount(state)).toEqual(mockAccount);
            expect(selectRecoveryNewWallet(state)).toEqual(mockWallet);
        });
    });
});
