import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmStep } from "./ConfirmStep";

const mocks = vi.hoisted(() => ({
    rpcReply: (_id: number): Response => new Response(null, { status: 500 }),
    sendRecoveryTxAsync: vi.fn(),
    deleteRecoveryBlobAsync: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const { createFakeRpcClient } = await import("@/tests/fakeRpcClient");
    return {
        ...(await importOriginal<typeof import("@frak-labs/wallet-shared")>()),
        currentViemClient: createFakeRpcClient((id) => mocks.rpcReply(id)),
    };
});
vi.mock("wagmi", () => ({
    useConnection: () => ({
        address: "0x1111111111111111111111111111111111111111",
    }),
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/module/recovery/action/generate", () => ({
    generateDisableRecoveryData: vi.fn(async () => ({ setupTxData: "0x" })),
}));
vi.mock("@/module/recovery-setup/hook/useSendRecoveryTx", () => ({
    useSendRecoveryTx: () => ({
        sendRecoveryTxAsync: mocks.sendRecoveryTxAsync,
        isPending: false,
    }),
}));
vi.mock("@/module/recovery-setup/hook/useDeleteRecoveryBlob", () => ({
    useDeleteRecoveryBlob: () => ({
        deleteRecoveryBlobAsync: mocks.deleteRecoveryBlobAsync,
        isPending: false,
    }),
}));
vi.mock("@/module/common/component/WarningCard", () => ({
    WarningCard: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
vi.mock("@/module/common/component/FlowStepScreen", () => ({
    FlowStepScreen: ({
        description,
        footer,
        children,
    }: {
        description: string;
        footer?: ReactNode;
        children?: ReactNode;
    }) => (
        <div>
            <p>{description}</p>
            {children}
            {footer}
        </div>
    ),
}));

describe("delete recovery ConfirmStep", () => {
    beforeEach(() => {
        mocks.sendRecoveryTxAsync.mockReset();
        mocks.deleteRecoveryBlobAsync.mockReset();
    });

    it.each([
        [
            "the RPC cannot be reached",
            () => new Response(null, { status: 503 }),
        ],
        [
            "the RPC answers an internal error",
            (id: number) =>
                Response.json({
                    jsonrpc: "2.0",
                    id,
                    error: { code: -32603, message: "Internal error" },
                }),
        ],
    ])("keeps the backup and reports a failure when %s", async (_, reply) => {
        mocks.rpcReply = reply;
        const onConfirmed = vi.fn();

        render(<ConfirmStep onConfirmed={onConfirmed} onBack={vi.fn()} />);
        fireEvent.click(
            screen.getByRole("button", {
                name: "wallet.recoverySetup.delete.confirm.authorise",
            })
        );

        await waitFor(() =>
            expect(
                screen.getByText(
                    "wallet.recoverySetup.delete.confirm.failedDescription"
                )
            ).toBeInTheDocument()
        );
        expect(mocks.deleteRecoveryBlobAsync).not.toHaveBeenCalled();
        expect(onConfirmed).not.toHaveBeenCalled();
    });
});
