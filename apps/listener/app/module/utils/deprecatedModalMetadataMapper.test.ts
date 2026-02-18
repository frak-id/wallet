import { describe, expect, it } from "vitest";
import { mapDeprecatedModalMetadata } from "./deprecatedModalMetadataMapper";

describe("mapDeprecatedModalMetadata", () => {
    describe("when request is undefined", () => {
        it("should return empty object when request is undefined", () => {
            const result = mapDeprecatedModalMetadata(undefined);
            expect(result).toEqual({});
        });
    });

    describe("when request type is unknown", () => {
        it("should return empty object when request has unknown type", () => {
            const result = mapDeprecatedModalMetadata({
                type: "unknown" as any,
                appName: "test",
                configMetadata: {},
            } as any);
            expect(result).toEqual({});
        });
    });

    describe("when request.type === 'embedded'", () => {
        it("should return empty object when loggedIn is missing", () => {
            const request = {
                type: "embedded" as const,
                appName: "test",
                configMetadata: {},
                params: {
                    loggedOut: { metadata: { text: "Log in" } },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result).toEqual({});
        });

        it("should return empty object when loggedOut is missing", () => {
            const request = {
                type: "embedded" as const,
                appName: "test",
                configMetadata: {},
                params: {
                    loggedIn: {
                        action: {
                            key: "sharing",
                            options: { popupTitle: "Share" },
                        },
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result).toEqual({});
        });

        it("should map sharing popupTitle to 'sharing.title' when loggedIn action is 'sharing'", () => {
            const request = {
                type: "embedded" as const,
                appName: "test",
                configMetadata: {},
                params: {
                    loggedIn: {
                        action: {
                            key: "sharing",
                            options: { popupTitle: "Share this!" },
                        },
                    },
                    loggedOut: { metadata: {} },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sharing.title"]).toBe("Share this!");
        });

        it("should map sharing text to 'sharing.text'", () => {
            const request = {
                type: "embedded" as const,
                appName: "test",
                configMetadata: {},
                params: {
                    loggedIn: {
                        action: {
                            key: "sharing",
                            options: { text: "Check this out" },
                        },
                    },
                    loggedOut: { metadata: {} },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sharing.text"]).toBe("Check this out");
        });

        it("should map loggedOut text to 'sdk.wallet.login.text'", () => {
            const request = {
                type: "embedded" as const,
                appName: "test",
                configMetadata: {},
                params: {
                    loggedIn: { action: { key: "other" } },
                    loggedOut: { metadata: { text: "Please log in" } },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sdk.wallet.login.text"]).toBe("Please log in");
        });

        it("should map loggedOut buttonText to 'sdk.wallet.login.primaryAction'", () => {
            const request = {
                type: "embedded" as const,
                appName: "test",
                configMetadata: {},
                params: {
                    loggedIn: { action: { key: "other" } },
                    loggedOut: { metadata: { buttonText: "Connect Wallet" } },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sdk.wallet.login.primaryAction"]).toBe(
                "Connect Wallet"
            );
        });

        it("should handle all fields present together", () => {
            const request = {
                type: "embedded" as const,
                appName: "test",
                configMetadata: {},
                params: {
                    loggedIn: {
                        action: {
                            key: "sharing",
                            options: {
                                popupTitle: "Share!",
                                text: "Check this out",
                            },
                        },
                    },
                    loggedOut: {
                        metadata: {
                            text: "Log in first",
                            buttonText: "Connect",
                        },
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result).toEqual({
                "sharing.title": "Share!",
                "sharing.text": "Check this out",
                "sdk.wallet.login.text": "Log in first",
                "sdk.wallet.login.primaryAction": "Connect",
            });
        });

        it("should skip undefined fields", () => {
            const request = {
                type: "embedded" as const,
                appName: "test",
                configMetadata: {},
                params: {
                    loggedIn: {
                        action: {
                            key: "sharing",
                            options: { popupTitle: "Share" },
                        },
                    },
                    loggedOut: { metadata: { text: "Log in" } },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result).toEqual({
                "sharing.title": "Share",
                "sdk.wallet.login.text": "Log in",
            });
            expect(result["sharing.text"]).toBeUndefined();
            expect(result["sdk.wallet.login.primaryAction"]).toBeUndefined();
        });

        it("should not map sharing when loggedIn action key is not 'sharing'", () => {
            const request = {
                type: "embedded" as const,
                appName: "test",
                configMetadata: {},
                params: {
                    loggedIn: {
                        action: {
                            key: "other",
                            options: { popupTitle: "Should not map" },
                        },
                    },
                    loggedOut: { metadata: { text: "Log in" } },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sharing.title"]).toBeUndefined();
            expect(result["sharing.text"]).toBeUndefined();
        });
    });

    describe("when request.type === 'modal'", () => {
        it("should map dismissActionTxt to 3 keys", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                steps: {
                    login: { metadata: { title: "Login" } },
                },
                metadata: { dismissActionTxt: "Maybe later" },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sdk.modal.dismiss.primaryAction"]).toBe(
                "Maybe later"
            );
            expect(result["sdk.modal.dismiss.primaryAction_sharing"]).toBe(
                "Maybe later"
            );
            expect(result["sdk.modal.dismiss.primaryAction_reward"]).toBe(
                "Maybe later"
            );
        });

        it("should map step metadata title to 3 keys", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                steps: {
                    login: { metadata: { title: "Welcome" } },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sdk.modal.login.title"]).toBe("Welcome");
            expect(result["sdk.modal.login.title_sharing"]).toBe("Welcome");
            expect(result["sdk.modal.login.title_reward"]).toBe("Welcome");
        });

        it("should map step description with {REWARD} replacement", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                steps: {
                    login: {
                        metadata: {
                            description: "Get {REWARD} reward",
                        },
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sdk.modal.login.description"]).toBe(
                "Get {{ estimatedReward }} reward"
            );
            expect(result["sdk.modal.login.description_sharing"]).toBe(
                "Get {{ estimatedReward }} reward"
            );
            expect(result["sdk.modal.login.description_reward"]).toBe(
                "Get {{ estimatedReward }} reward"
            );
        });

        it("should map primaryActionText to 3 keys", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                steps: {
                    login: {
                        metadata: {
                            primaryActionText: "Continue",
                        },
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sdk.modal.login.primaryAction"]).toBe("Continue");
            expect(result["sdk.modal.login.primaryAction_sharing"]).toBe(
                "Continue"
            );
            expect(result["sdk.modal.login.primaryAction_reward"]).toBe(
                "Continue"
            );
        });

        it("should map secondaryActionText to 3 keys", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                steps: {
                    login: {
                        metadata: {
                            secondaryActionText: "Skip",
                        },
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sdk.modal.login.secondaryAction"]).toBe("Skip");
            expect(result["sdk.modal.login.secondaryAction_sharing"]).toBe(
                "Skip"
            );
            expect(result["sdk.modal.login.secondaryAction_reward"]).toBe(
                "Skip"
            );
        });

        it("should map dismissedMetadata when present", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                steps: {
                    login: {
                        metadata: { title: "Login" },
                        dismissedMetadata: {
                            title: "Dismissed Title",
                            description: "You dismissed with {REWARD}",
                        },
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sdk.modal.login.dismissed.title"]).toBe(
                "Dismissed Title"
            );
            expect(result["sdk.modal.login.dismissed.title_sharing"]).toBe(
                "Dismissed Title"
            );
            expect(result["sdk.modal.login.dismissed.title_reward"]).toBe(
                "Dismissed Title"
            );
            expect(result["sdk.modal.login.dismissed.description"]).toBe(
                "You dismissed with {{ estimatedReward }}"
            );
            expect(
                result["sdk.modal.login.dismissed.description_sharing"]
            ).toBe("You dismissed with {{ estimatedReward }}");
            expect(result["sdk.modal.login.dismissed.description_reward"]).toBe(
                "You dismissed with {{ estimatedReward }}"
            );
        });

        it("should map sharing action options for 'final' step with action.key 'sharing'", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                steps: {
                    final: {
                        metadata: { title: "Done" },
                        action: {
                            key: "sharing",
                            options: {
                                popupTitle: "Share your success",
                                text: "I just completed this",
                            },
                        },
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sharing.title"]).toBe("Share your success");
            expect(result["sharing.text"]).toBe("I just completed this");
        });

        it("should not map sharing for non-final steps", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                steps: {
                    login: {
                        metadata: { title: "Login" },
                        action: {
                            key: "sharing",
                            options: {
                                popupTitle: "Should not map",
                                text: "Should not map",
                            },
                        },
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sharing.title"]).toBeUndefined();
            expect(result["sharing.text"]).toBeUndefined();
        });

        it("should not map sharing for final step with non-sharing action", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                steps: {
                    final: {
                        metadata: { title: "Done" },
                        action: {
                            key: "other",
                            options: {
                                popupTitle: "Should not map",
                                text: "Should not map",
                            },
                        },
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sharing.title"]).toBeUndefined();
            expect(result["sharing.text"]).toBeUndefined();
        });

        it("should handle multiple steps", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                steps: {
                    login: {
                        metadata: {
                            title: "Login",
                            description: "Sign in to continue",
                        },
                    },
                    verify: {
                        metadata: {
                            title: "Verify",
                            primaryActionText: "Verify",
                        },
                    },
                    final: {
                        metadata: {
                            title: "Complete",
                            secondaryActionText: "Done",
                        },
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sdk.modal.login.title"]).toBe("Login");
            expect(result["sdk.modal.login.description"]).toBe(
                "Sign in to continue"
            );
            expect(result["sdk.modal.verify.title"]).toBe("Verify");
            expect(result["sdk.modal.verify.primaryAction"]).toBe("Verify");
            expect(result["sdk.modal.final.title"]).toBe("Complete");
            expect(result["sdk.modal.final.secondaryAction"]).toBe("Done");
        });

        it("should skip undefined metadata fields", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                steps: {
                    login: {
                        metadata: {
                            title: "Login",
                        },
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result["sdk.modal.login.title"]).toBe("Login");
            expect(result["sdk.modal.login.description"]).toBeUndefined();
            expect(result["sdk.modal.login.primaryAction"]).toBeUndefined();
            expect(result["sdk.modal.login.secondaryAction"]).toBeUndefined();
        });

        it("should handle empty metadata object", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                steps: {
                    login: {
                        metadata: {},
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result).toEqual({});
        });

        it("should handle null metadata", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                steps: {
                    login: {
                        metadata: null,
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);
            expect(result).toEqual({});
        });

        it("should handle complex scenario with all features", () => {
            const request = {
                type: "modal" as const,
                appName: "test",
                configMetadata: {},
                metadata: { dismissActionTxt: "Cancel" },
                steps: {
                    login: {
                        metadata: {
                            title: "Login",
                            description: "Earn {REWARD}",
                            primaryActionText: "Sign In",
                        },
                        dismissedMetadata: {
                            title: "Dismissed",
                            primaryActionText: "Try Again",
                        },
                    },
                    final: {
                        metadata: {
                            title: "Success",
                            secondaryActionText: "Close",
                        },
                        action: {
                            key: "sharing",
                            options: {
                                popupTitle: "Share",
                                text: "I earned {REWARD}",
                            },
                        },
                    },
                },
                emitter: async () => {},
            };
            const result = mapDeprecatedModalMetadata(request as any);

            // Dismiss action
            expect(result["sdk.modal.dismiss.primaryAction"]).toBe("Cancel");

            // Login step
            expect(result["sdk.modal.login.title"]).toBe("Login");
            expect(result["sdk.modal.login.description"]).toBe(
                "Earn {{ estimatedReward }}"
            );
            expect(result["sdk.modal.login.primaryAction"]).toBe("Sign In");

            // Login dismissed
            expect(result["sdk.modal.login.dismissed.title"]).toBe("Dismissed");
            expect(result["sdk.modal.login.dismissed.primaryAction"]).toBe(
                "Try Again"
            );

            // Final step
            expect(result["sdk.modal.final.title"]).toBe("Success");
            expect(result["sdk.modal.final.secondaryAction"]).toBe("Close");

            // Sharing
            expect(result["sharing.title"]).toBe("Share");
            expect(result["sharing.text"]).toBe("I earned {REWARD}");
        });
    });
});
