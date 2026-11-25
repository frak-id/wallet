import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { ValidateStep } from "./ValidateStep";

const query = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/module/recovery/hook/useOnChainRecovery", () => ({
    useOnChainRecovery: () => query.current,
}));
vi.mock("@/module/common/hook/useDateFormatter", () => ({
    useDateFormatter: () => ({ format: String }),
}));
vi.mock("@/module/recovery/hook/useRunRecovery", () => ({
    useRunRecovery: () => ({ runRecoveryAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/module/common/component/FlowStepScreen", () => ({
    FlowStepScreen: ({
        title,
        footer,
    }: {
        title: string;
        footer?: ReactNode;
    }) => (
        <div>
            <h1>{title}</h1>
            {footer}
        </div>
    ),
}));

describe("ValidateStep", () => {
    it("keeps the recovery screen when a background refetch fails", () => {
        const guardianAccount = privateKeyToAccount(`0x${"22".repeat(32)}`);
        query.current = {
            data: {
                executor: "0x3333333333333333333333333333333333333333",
                guardianAddress: guardianAccount.address,
                validAfter: 0,
                validUntil: 0,
            },
            isLoading: false,
            isError: true,
            isFetching: false,
            refetch: vi.fn(),
        };

        render(
            <ValidateStep
                walletAddress="0x1111111111111111111111111111111111111111"
                guardianAccount={guardianAccount}
                onRecovered={vi.fn()}
                onBack={vi.fn()}
            />
        );

        expect(
            screen.getByRole("button", {
                name: "wallet.recoveryUsage.validate.authorise",
            })
        ).toBeInTheDocument();
    });

    it("offers a retry instead of loading forever when the chain read fails", () => {
        const refetch = vi.fn();
        query.current = {
            data: undefined,
            isLoading: false,
            isError: true,
            isFetching: false,
            refetch,
        };

        render(
            <ValidateStep
                walletAddress="0x1111111111111111111111111111111111111111"
                guardianAccount={privateKeyToAccount(`0x${"22".repeat(32)}`)}
                onRecovered={vi.fn()}
                onBack={vi.fn()}
            />
        );

        expect(
            screen.getByText("wallet.recoveryUsage.validate.readError.title")
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", {
                name: "wallet.recoveryUsage.validate.retry",
            })
        );
        expect(refetch).toHaveBeenCalledTimes(1);
    });
});
