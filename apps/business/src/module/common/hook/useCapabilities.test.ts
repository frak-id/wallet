import { renderHook } from "@testing-library/react";
import type { Address } from "viem";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useCapabilities } from "./useCapabilities";

const WALLET = "0x0000000000000000000000000000000000000001" as Address;

describe("useCapabilities", () => {
    test("canOnchain is false for a walletless account", ({
        freshAuthStore,
    }: TestContext) => {
        freshAuthStore.getState().setAuth({
            token: "tok",
            authMethod: "password",
            expiresAt: Date.now() + 10_000,
        });

        const { result } = renderHook(() => useCapabilities());
        expect(result.current.canOnchain).toBe(false);
    });

    test("canOnchain is true once a wallet is linked", ({
        freshAuthStore,
    }: TestContext) => {
        freshAuthStore.getState().setAuth({
            token: "tok",
            wallet: WALLET,
            authMethod: "siwe",
            expiresAt: Date.now() + 10_000,
        });

        const { result } = renderHook(() => useCapabilities());
        expect(result.current.canOnchain).toBe(true);
    });
});
