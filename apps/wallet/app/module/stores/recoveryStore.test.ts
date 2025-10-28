import type {
    RecoveryFileContent,
    WebAuthNWallet,
} from "@frak-labs/wallet-shared";
import type { LocalAccount } from "viem";
import { beforeEach, describe, expect, it } from "vitest";
import {
    recoveryStore,
    selectRecoveryFileContent,
    selectRecoveryGuardianAccount,
    selectRecoveryNewWallet,
    selectRecoveryOptions,
    selectRecoveryPassword,
    selectRecoveryStep,
} from "@/module/stores/recoveryStore";

describe("recoveryStore", () => {
    beforeEach(() => {
        // Reset store to initial state before each test
        recoveryStore.getState().reset();
    });

    describe("initial state", () => {
        it("should have correct initial values", () => {
            const state = recoveryStore.getState();

            expect(state.step).toBe(1);
            expect(state.password).toBeUndefined();
            expect(state.options).toBeUndefined();
            expect(state.fileContent).toBeNull();
            expect(state.guardianAccount).toBeNull();
            expect(state.newWallet).toBeNull();
        });
    });

    describe("setStep", () => {
        it("should update the step", () => {
            recoveryStore.getState().setStep(2);
            expect(recoveryStore.getState().step).toBe(2);

            recoveryStore.getState().setStep(4);
            expect(recoveryStore.getState().step).toBe(4);
        });

        it("should work with selector", () => {
            recoveryStore.getState().setStep(3);
            expect(selectRecoveryStep(recoveryStore.getState())).toBe(3);
        });
    });

    describe("setPassword", () => {
        it("should set password", () => {
            recoveryStore.getState().setPassword("test-password-123");
            expect(recoveryStore.getState().password).toBe("test-password-123");
        });

        it("should clear password when undefined", () => {
            recoveryStore.getState().setPassword("test-password");
            recoveryStore.getState().setPassword(undefined);
            expect(recoveryStore.getState().password).toBeUndefined();
        });

        it("should work with selector", () => {
            recoveryStore.getState().setPassword("my-password");
            expect(selectRecoveryPassword(recoveryStore.getState())).toBe(
                "my-password"
            );
        });
    });

    describe("setOptions", () => {
        it("should set recovery options", () => {
            const mockOptions = {
                setupTxData: "0x123abc" as `0x${string}`,
                file: {
                    initialWallet: { address: "0xWallet" },
                    guardianAddress: "0xGuardian",
                } as unknown as RecoveryFileContent,
            };

            recoveryStore.getState().setOptions(mockOptions);
            expect(recoveryStore.getState().options).toEqual(mockOptions);
        });

        it("should clear options when undefined", () => {
            const mockOptions = {
                setupTxData: "0x123abc" as `0x${string}`,
                file: {} as unknown as RecoveryFileContent,
            };

            recoveryStore.getState().setOptions(mockOptions);
            recoveryStore.getState().setOptions(undefined);
            expect(recoveryStore.getState().options).toBeUndefined();
        });

        it("should work with selector", () => {
            const mockOptions = {
                setupTxData: "0x123abc" as `0x${string}`,
                file: {} as unknown as RecoveryFileContent,
            };

            recoveryStore.getState().setOptions(mockOptions);
            expect(selectRecoveryOptions(recoveryStore.getState())).toEqual(
                mockOptions
            );
        });
    });

    describe("setFileContent", () => {
        it("should set file content", () => {
            const mockFile: RecoveryFileContent = {
                initialWallet: { address: "0xWallet" },
                guardianAddress: "0xGuardian",
                guardianPrivateKeyEncrypted: "encrypted-data",
            } as unknown as RecoveryFileContent;

            recoveryStore.getState().setFileContent(mockFile);
            expect(recoveryStore.getState().fileContent).toEqual(mockFile);
        });

        it("should clear file content when null", () => {
            const mockFile = {} as unknown as RecoveryFileContent;

            recoveryStore.getState().setFileContent(mockFile);
            recoveryStore.getState().setFileContent(null);
            expect(recoveryStore.getState().fileContent).toBeNull();
        });

        it("should work with selector", () => {
            const mockFile = {} as unknown as RecoveryFileContent;

            recoveryStore.getState().setFileContent(mockFile);
            expect(selectRecoveryFileContent(recoveryStore.getState())).toEqual(
                mockFile
            );
        });
    });

    describe("setGuardianAccount", () => {
        it("should set guardian account", () => {
            const mockAccount = {
                address: "0xGuardian",
                signMessage: () => {},
            } as unknown as LocalAccount;

            recoveryStore.getState().setGuardianAccount(mockAccount);
            expect(recoveryStore.getState().guardianAccount).toEqual(
                mockAccount
            );
        });

        it("should clear guardian account when null", () => {
            const mockAccount = {
                address: "0xGuardian",
            } as unknown as LocalAccount;

            recoveryStore.getState().setGuardianAccount(mockAccount);
            recoveryStore.getState().setGuardianAccount(null);
            expect(recoveryStore.getState().guardianAccount).toBeNull();
        });

        it("should work with selector", () => {
            const mockAccount = {
                address: "0xGuardian",
            } as unknown as LocalAccount;

            recoveryStore.getState().setGuardianAccount(mockAccount);
            expect(
                selectRecoveryGuardianAccount(recoveryStore.getState())
            ).toEqual(mockAccount);
        });
    });

    describe("setNewWallet", () => {
        it("should set new wallet", () => {
            const mockWallet = {
                address: "0xNewWallet",
                authenticatorId: "auth-123",
            } as unknown as WebAuthNWallet;

            recoveryStore.getState().setNewWallet(mockWallet);
            expect(recoveryStore.getState().newWallet).toEqual(mockWallet);
        });

        it("should clear new wallet when null", () => {
            const mockWallet = {
                address: "0xNewWallet",
            } as unknown as WebAuthNWallet;

            recoveryStore.getState().setNewWallet(mockWallet);
            recoveryStore.getState().setNewWallet(null);
            expect(recoveryStore.getState().newWallet).toBeNull();
        });

        it("should work with selector", () => {
            const mockWallet = {
                address: "0xNewWallet",
            } as unknown as WebAuthNWallet;

            recoveryStore.getState().setNewWallet(mockWallet);
            expect(selectRecoveryNewWallet(recoveryStore.getState())).toEqual(
                mockWallet
            );
        });
    });

    describe("reset", () => {
        it("should reset all state to initial values", () => {
            // Set various state values
            recoveryStore.getState().setStep(3);
            recoveryStore.getState().setPassword("test-pass");
            recoveryStore.getState().setOptions({
                setupTxData: "0xabc" as `0x${string}`,
                file: {} as unknown as RecoveryFileContent,
            });
            recoveryStore
                .getState()
                .setFileContent({} as unknown as RecoveryFileContent);
            recoveryStore
                .getState()
                .setGuardianAccount({} as unknown as LocalAccount);
            recoveryStore
                .getState()
                .setNewWallet({} as unknown as WebAuthNWallet);

            // Reset
            recoveryStore.getState().reset();

            // Verify all values are back to initial state
            const state = recoveryStore.getState();
            expect(state.step).toBe(1);
            expect(state.password).toBeUndefined();
            expect(state.options).toBeUndefined();
            expect(state.fileContent).toBeNull();
            expect(state.guardianAccount).toBeNull();
            expect(state.newWallet).toBeNull();
        });
    });

    describe("selectors", () => {
        it("should select correct values from state", () => {
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

            recoveryStore.getState().setStep(2);
            recoveryStore.getState().setPassword("password");
            recoveryStore.getState().setOptions(mockOptions);
            recoveryStore.getState().setFileContent(mockFile);
            recoveryStore.getState().setGuardianAccount(mockAccount);
            recoveryStore.getState().setNewWallet(mockWallet);

            const state = recoveryStore.getState();

            expect(selectRecoveryStep(state)).toBe(2);
            expect(selectRecoveryPassword(state)).toBe("password");
            expect(selectRecoveryOptions(state)).toEqual(mockOptions);
            expect(selectRecoveryFileContent(state)).toEqual(mockFile);
            expect(selectRecoveryGuardianAccount(state)).toEqual(mockAccount);
            expect(selectRecoveryNewWallet(state)).toEqual(mockWallet);
        });
    });
});
