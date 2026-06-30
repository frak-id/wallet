import type { SendTransactionModalStepType } from "@frak-labs/core-sdk";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { TransactionModalStep } from "./index";

// Hoisted, mutable test doubles read by the vi.mock factories below.
const sendTransactionMock = vi.hoisted(() => vi.fn());
const emitRedirectWithFallbackMock = vi.hoisted(() => vi.fn());
// Reactive bridge to the zustand-backed wagmi mock (see below). Flipping
// `isPending` re-renders the parent the same way wagmi's mutation store does.
const txControl = vi.hoisted(() => ({
    setPending: (_value: boolean) => {},
    reset: () => {},
}));
// Captures the 30s timeout callback so the test can fire it deterministically
// instead of relying on real/fake timers.
const timer = vi.hoisted(() => ({ cb: null as null | (() => void) }));

vi.mock("@frak-labs/wallet-shared/authentication", () => ({
    useWebauthnErrorToast: () => {},
}));

vi.mock("@frak-labs/wallet-shared/common", () => ({
    ua: { isMobile: true },
    prefixModalCss: (name: string) => `nexus-modal-${name}`,
    startFlow: () => ({ end: vi.fn(), track: vi.fn(), ended: false }),
    useMountedTimeout: () => ({
        startTimeout: (cb: () => void) => {
            timer.cb = cb;
        },
        clearTimeout: () => {
            timer.cb = null;
        },
    }),
    webauthnErrorContext: () => ({}),
}));

vi.mock("@frak-labs/wallet-shared/stores/sessionStore", async () => {
    const { create } = await import("zustand");
    const sessionStore = create(() => ({
        session: { type: "distant-webauthn" },
    }));
    return { sessionStore };
});

vi.mock("@frak-labs/wallet-shared/wallet/utils/multicall", () => ({
    encodeWalletMulticall: () => "0x",
}));

vi.mock("wagmi", async () => {
    const { create } = await import("zustand");
    // Mirrors wagmi's mutation store: mutating `isPending` re-renders every
    // component subscribed through `useSendTransaction`.
    const txStore = create(() => ({
        isPending: false,
        isError: false,
        error: null as Error | null,
    }));
    txControl.setPending = (value: boolean) =>
        txStore.setState({ isPending: value });
    txControl.reset = () =>
        txStore.setState({ isPending: false, isError: false, error: null });
    return {
        useConnection: () => ({
            address: "0x1111111111111111111111111111111111111111",
        }),
        useSendTransaction: () => ({
            mutate: sendTransactionMock,
            isPending: txStore((s) => s.isPending),
            isError: txStore((s) => s.isError),
            error: txStore((s) => s.error),
        }),
    };
});

vi.mock("@/module/hooks/useDeepLinkFallback", () => ({
    useDeepLinkFallback: () => ({
        emitRedirectWithFallback: emitRedirectWithFallbackMock,
    }),
}));

vi.mock("@/module/modal/component/Transaction/AccordionTransactions", () => ({
    AccordionTransactions: ({ txs }: { txs: unknown[] }) => (
        <div data-testid="accordion">{txs.length}</div>
    ),
}));

vi.mock("@/ui/ListenerUiProvider", () => ({
    useListenerTranslation: () => ({ t: (key: string) => key }),
}));

function renderTx() {
    return render(
        <TransactionModalStep
            params={
                {
                    tx: {
                        to: "0x2222222222222222222222222222222222222222",
                        data: "0x",
                    },
                } as SendTransactionModalStepType["params"]
            }
            onFinish={vi.fn()}
        />
    );
}

describe("TransactionModalStep (mobile pairing)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        txControl.reset();
        timer.cb = null;
        // Submitting flips the wagmi mutation into its pending state so the
        // clear-timeout effect does not cancel the in-flight request.
        sendTransactionMock.mockImplementation(() =>
            txControl.setPending(true)
        );
        emitRedirectWithFallbackMock.mockImplementation(() => {});
    });

    test("renders the mobile flow and fires the wallet deep link on submit", () => {
        renderTx();

        expect(screen.getByTestId("accordion")).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", { name: "mobile-tx.sendTransaction" })
        );

        expect(sendTransactionMock).toHaveBeenCalledWith(
            expect.objectContaining({
                to: "0x2222222222222222222222222222222222222222",
            })
        );
        expect(emitRedirectWithFallbackMock).toHaveBeenCalledTimes(1);
        expect(emitRedirectWithFallbackMock.mock.calls[0][0]).toContain(
            "wallet"
        );
    });

    test("shows the app-not-found state and recovers on retry", () => {
        // Simulate the deep link failing to open the native app.
        emitRedirectWithFallbackMock.mockImplementation(
            (_url: string, onFallback: () => void) => onFallback()
        );

        renderTx();

        fireEvent.click(
            screen.getByRole("button", { name: "mobile-tx.sendTransaction" })
        );

        expect(screen.getByText("mobile-tx.appNotFound")).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", { name: "mobile-tx.retry" })
        );

        expect(screen.queryByText("mobile-tx.appNotFound")).toBeNull();
        expect(
            screen.getByRole("button", { name: "mobile-tx.sendTransaction" })
        ).toBeInTheDocument();
    });

    test("surfaces the timeout state when the wallet does not respond", () => {
        renderTx();

        fireEvent.click(
            screen.getByRole("button", { name: "mobile-tx.sendTransaction" })
        );

        // The 30s timeout fires while the request is still pending.
        expect(timer.cb).toBeTypeOf("function");
        act(() => {
            timer.cb?.();
        });

        expect(screen.getByText("mobile-tx.timeout")).toBeInTheDocument();
    });
});
