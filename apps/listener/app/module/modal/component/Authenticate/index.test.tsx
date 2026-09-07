import { RpcErrorCodes } from "@frak-labs/frame-connector";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { SiweAuthenticateModalStep } from "./index";

vi.mock("@/ui/ListenerUiProvider", () => ({
    useListenerTranslation: () => ({
        t: (value: string) => value,
        i18n: { exists: () => false },
    }),
}));

vi.mock("@frak-labs/wallet-shared/authentication", () => ({
    useWebauthnErrorToast: vi.fn(),
}));

const signMessageMock = vi.hoisted(() => vi.fn());

vi.mock("wagmi", () => ({
    useConnection: () => ({
        address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        chainId: 1,
    }),
    useSignMessage: () => ({
        mutate: signMessageMock,
        isPending: false,
        error: null,
    }),
}));

const baseSiwe = {
    statement: "Verify your identity to continue",
    uri: "https://example.com",
    version: "1" as const,
    domain: "example.com",
};

function renderStep(
    nonce: string,
    onError: (reason: string, code?: number) => void
) {
    return render(
        <SiweAuthenticateModalStep
            params={{ siwe: { ...baseSiwe, nonce } }}
            onFinish={vi.fn()}
            onError={onError}
        />
    );
}

describe("SiweAuthenticateModalStep", () => {
    beforeEach(() => {
        signMessageMock.mockClear();
    });

    test("rejects the request when a field fails EIP-4361 validation", () => {
        const onError = vi.fn();
        renderStep("OLIy4nA-dfooXG6RhwdlCg", onError);

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0]).toMatch(/nonce/i);
        expect(onError.mock.calls[0][1]).toBe(RpcErrorCodes.serverError);
    });

    test("builds the message for a valid nonce", () => {
        const onError = vi.fn();
        renderStep("abcdef0123456789", onError);

        expect(onError).not.toHaveBeenCalled();
        screen.getByRole("button").click();
        expect(signMessageMock).toHaveBeenCalledTimes(1);
    });
});
