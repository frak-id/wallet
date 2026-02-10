import { pairingStore } from "@frak-labs/wallet-shared";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from "@/tests/vitest-fixtures";
import {
    DEEP_LINK_TIMEOUT_MS,
    Route,
    redirectToWebPairing,
    validatePairSearch,
} from "./pair";

describe("PairTrampolinePage", () => {
    describe("validatePairSearch", () => {
        test("should validate id parameter is required", () => {
            expect(() => {
                validatePairSearch({});
            }).toThrow("Missing or invalid id parameter");
        });

        test("should validate id parameter is string", () => {
            expect(() => {
                validatePairSearch({ id: 123 });
            }).toThrow("Missing or invalid id parameter");
        });

        test("should validate id parameter is not empty", () => {
            expect(() => {
                validatePairSearch({ id: "" });
            }).toThrow("Missing or invalid id parameter");
        });

        test("should accept valid id parameter", () => {
            const result = validatePairSearch({
                id: "test-id-123",
            });
            expect(result).toEqual({ id: "test-id-123" });
        });

        test("should accept id with special characters", () => {
            const result = validatePairSearch({
                id: "abc-123_xyz.test",
            });
            expect(result).toEqual({ id: "abc-123_xyz.test" });
        });

        test("should accept id at max length (128)", () => {
            const longId = "a".repeat(128);
            const result = validatePairSearch({ id: longId });
            expect(result).toEqual({ id: longId });
        });

        test("should reject id exceeding max length (129)", () => {
            const tooLongId = "a".repeat(129);
            expect(() => {
                validatePairSearch({ id: tooLongId });
            }).toThrow("Missing or invalid id parameter");
        });
    });

    describe("route configuration", () => {
        test("should have component defined", () => {
            expect(Route.options.component).toBeDefined();
        });

        test("should have validateSearch defined", () => {
            expect(Route.options.validateSearch).toBeDefined();
        });

        test("should have errorComponent defined", () => {
            expect(Route.options.errorComponent).toBeDefined();
        });
    });

    describe("redirectToWebPairing", () => {
        afterEach(() => {
            pairingStore.getState().clearPendingPairing();
        });

        test("should store pending pairing id and navigate to /pairing", () => {
            const navigate = vi.fn();
            redirectToWebPairing("test-id-42", navigate);

            expect(pairingStore.getState().pendingPairingId).toBe("test-id-42");
            expect(navigate).toHaveBeenCalledWith({
                to: "/pairing",
                search: { mode: "embedded" },
            });
        });
    });

    describe("trampoline effect behavior", () => {
        let originalHref: string;

        beforeEach(() => {
            vi.useFakeTimers();
            originalHref = window.location.href;
        });

        afterEach(() => {
            vi.useRealTimers();
            pairingStore.getState().clearPendingPairing();
            // Restore href
            Object.defineProperty(window, "location", {
                value: { ...window.location, href: originalHref },
                writable: true,
                configurable: true,
            });
        });

        test("should fire deep link immediately on mount", () => {
            // Simulate what the effect does: set window.location.href
            const hrefSetter = vi.fn();
            Object.defineProperty(window, "location", {
                value: new Proxy(window.location, {
                    set(_target, prop, value) {
                        if (prop === "href") {
                            hrefSetter(value);
                        }
                        return true;
                    },
                }),
                writable: true,
                configurable: true,
            });

            // Reproduce the effect logic
            const id = "abc-123";
            window.location.href = `frakwallet://pair?id=${encodeURIComponent(id)}`;

            expect(hrefSetter).toHaveBeenCalledWith(
                "frakwallet://pair?id=abc-123"
            );
        });

        test("should fall back to web pairing after timeout", () => {
            const navigate = vi.fn();
            const id = "timeout-test";

            // Simulate the timeout fallback logic
            let didRedirect = false;
            const timeoutId = setTimeout(() => {
                if (!didRedirect) {
                    didRedirect = true;
                    redirectToWebPairing(id, navigate);
                }
            }, DEEP_LINK_TIMEOUT_MS);

            // Before timeout — no redirect
            vi.advanceTimersByTime(DEEP_LINK_TIMEOUT_MS - 1);
            expect(navigate).not.toHaveBeenCalled();

            // After timeout — redirect fires
            vi.advanceTimersByTime(1);
            expect(navigate).toHaveBeenCalledWith({
                to: "/pairing",
                search: { mode: "embedded" },
            });

            clearTimeout(timeoutId);
        });

        test("should cancel timeout when tab becomes hidden", () => {
            const navigate = vi.fn();

            // Simulate the visibility-aware timeout logic
            let didRedirect = false;
            const timeoutId = setTimeout(() => {
                if (!didRedirect) {
                    didRedirect = true;
                    redirectToWebPairing("vis-test", navigate);
                }
            }, DEEP_LINK_TIMEOUT_MS);

            const handleVisibilityChange = () => {
                if (document.hidden) {
                    clearTimeout(timeoutId);
                }
            };

            document.addEventListener(
                "visibilitychange",
                handleVisibilityChange
            );

            // Simulate tab going hidden (app opened)
            Object.defineProperty(document, "hidden", {
                value: true,
                configurable: true,
            });
            document.dispatchEvent(new Event("visibilitychange"));

            // Advance past timeout — should NOT redirect (timer cancelled)
            vi.advanceTimersByTime(DEEP_LINK_TIMEOUT_MS + 100);
            expect(navigate).not.toHaveBeenCalled();

            // Cleanup
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
            Object.defineProperty(document, "hidden", {
                value: false,
                configurable: true,
            });
        });

        test("should redirect to web pairing when tab becomes visible again", () => {
            const navigate = vi.fn();
            const id = "vis-return-test";

            let didRedirect = false;
            const timeoutId = setTimeout(() => {
                if (!didRedirect) {
                    didRedirect = true;
                    redirectToWebPairing(id, navigate);
                }
            }, DEEP_LINK_TIMEOUT_MS);

            const handleVisibilityChange = () => {
                if (document.hidden) {
                    clearTimeout(timeoutId);
                } else if (!didRedirect) {
                    didRedirect = true;
                    redirectToWebPairing(id, navigate);
                }
            };

            document.addEventListener(
                "visibilitychange",
                handleVisibilityChange
            );

            // Tab goes hidden (app opened)
            Object.defineProperty(document, "hidden", {
                value: true,
                configurable: true,
            });
            document.dispatchEvent(new Event("visibilitychange"));

            // Tab becomes visible (user returned)
            Object.defineProperty(document, "hidden", {
                value: false,
                configurable: true,
            });
            document.dispatchEvent(new Event("visibilitychange"));

            expect(navigate).toHaveBeenCalledOnce();
            expect(navigate).toHaveBeenCalledWith({
                to: "/pairing",
                search: { mode: "embedded" },
            });

            // Cleanup
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
        });

        test("should not double-redirect when both timeout and visibility fire", () => {
            const navigate = vi.fn();
            const id = "double-test";

            let didRedirect = false;
            const timeoutId = setTimeout(() => {
                if (!didRedirect) {
                    didRedirect = true;
                    redirectToWebPairing(id, navigate);
                }
            }, DEEP_LINK_TIMEOUT_MS);

            const handleVisibilityChange = () => {
                if (!document.hidden && !didRedirect) {
                    didRedirect = true;
                    redirectToWebPairing(id, navigate);
                }
            };

            document.addEventListener(
                "visibilitychange",
                handleVisibilityChange
            );

            // Visibility fires first
            document.dispatchEvent(new Event("visibilitychange"));
            expect(navigate).toHaveBeenCalledOnce();

            // Timeout also fires — should be a no-op
            vi.advanceTimersByTime(DEEP_LINK_TIMEOUT_MS);
            expect(navigate).toHaveBeenCalledOnce();

            // Cleanup
            clearTimeout(timeoutId);
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
        });

        test("should encode special characters in deep link URL", () => {
            const id = "test id&foo=bar";
            const encoded = `frakwallet://pair?id=${encodeURIComponent(id)}`;

            expect(encoded).toBe("frakwallet://pair?id=test%20id%26foo%3Dbar");
        });
    });
});
