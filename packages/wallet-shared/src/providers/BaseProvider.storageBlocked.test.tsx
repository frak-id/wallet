import { render } from "@testing-library/react";
import { vi } from "vitest";
import { afterEach, describe, expect, test } from "../../tests/vitest-fixtures";
import { WagmiProviderWithDynamicConfig } from "./BaseProvider";

vi.mock("@frak-labs/app-essentials/blockchain", async (importOriginal) => {
    const { http } = await import("viem");
    return {
        ...(await importOriginal<object>()),
        getTransport: vi.fn(() => http()),
    };
});

vi.mock("../wallet/smartWallet/connector", async () => {
    const { mock } = await import("wagmi");
    return {
        smartAccountConnector: vi.fn(() =>
            mock({ accounts: ["0x0000000000000000000000000000000000000001"] })
        ),
    };
});

describe("WagmiProviderWithDynamicConfig with storage blocked", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

    afterEach(() => {
        if (descriptor) {
            Object.defineProperty(window, "localStorage", descriptor);
        }
    });

    test("renders its children", () => {
        Object.defineProperty(window, "localStorage", {
            configurable: true,
            get() {
                throw new DOMException("Access is denied", "SecurityError");
            },
        });

        const { getByText } = render(
            <WagmiProviderWithDynamicConfig>
                <div>Modal</div>
            </WagmiProviderWithDynamicConfig>
        );

        expect(getByText("Modal")).toBeTruthy();
    });
});
