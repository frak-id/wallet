/** @jsxImportSource react */
import type { MoneriumStatusResponse } from "@backend-domain/monerium/schemas";
import type * as WalletShared from "@frak-labs/wallet-shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { moneriumFlowStore } from "@/module/monerium/store/moneriumFlowStore";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { MONERIUM_PORTAL_URL } from "@/module/monerium/utils/moneriumConfig";
import { moneriumStatus } from "@/tests/moneriumFixtures";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({
    status: { current: undefined as MoneriumStatusResponse | undefined },
    isError: { current: false },
    refetch: vi.fn(),
    openExternalUrl: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => ({
    ...(await importOriginal<typeof WalletShared>()),
    openExternalUrl: mocks.openExternalUrl,
}));
vi.mock("@/module/monerium/hooks/useMoneriumStatus", () => ({
    useMoneriumStatus: () => ({
        status: mocks.status.current,
        isError: mocks.isError.current,
        refetch: mocks.refetch,
    }),
}));
vi.mock("@/module/monerium/hooks/useMoneriumBeneficiarySync", () => ({
    useMoneriumBeneficiarySync: vi.fn(),
}));
vi.mock("./MoneriumConnectScreen", () => ({
    MoneriumConnectScreen: ({ variant }: { variant: string }) => (
        <p>connect:{variant}</p>
    ),
}));
vi.mock("./MoneriumPendingScreen", () => ({
    MoneriumPendingScreen: ({ variant }: { variant: string }) => (
        <p>pending:{variant}</p>
    ),
}));
vi.mock("./MoneriumLinkScreen", () => ({
    MoneriumLinkScreen: () => <p>link</p>,
}));
vi.mock("./MoneriumTransferAmountScreen", () => ({
    MoneriumTransferAmountScreen: () => <p>transfer-amount</p>,
}));
vi.mock("./MoneriumTransferRecapScreen", () => ({
    MoneriumTransferRecapScreen: () => <p>transfer-recap</p>,
}));
vi.mock("./MoneriumTransferIbanScreen", () => ({
    MoneriumTransferIbanScreen: () => <p>transfer-iban</p>,
}));

import { MoneriumBankFlow } from "./index";

const ready = moneriumStatus();
const needsLink = moneriumStatus({ walletLink: "none" });

describe("MoneriumBankFlow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.status.current = ready;
        mocks.isError.current = false;
        moneriumStore.getState().reset();
        moneriumStore.getState().markSetupSuccessSeen();
        moneriumFlowStore.getState().resetTransfer();
    });

    test("while the status loads it shows a screen the user can close", () => {
        mocks.status.current = undefined;
        const onClose = vi.fn();
        render(<MoneriumBankFlow onClose={onClose} />);

        fireEvent.click(screen.getByRole("button", { name: "common.close" }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    test("a status that failed to load offers a retry", () => {
        mocks.status.current = undefined;
        mocks.isError.current = true;
        render(<MoneriumBankFlow onClose={vi.fn()} />);

        fireEvent.click(screen.getByText("monerium.bankFlow.loadError.retry"));
        expect(mocks.refetch).toHaveBeenCalledOnce();
    });

    test("a closed profile sends the user to the Monerium portal of its environment", () => {
        mocks.status.current = moneriumStatus({
            profile: { id: "p", kind: "personal", state: "closed" },
        });
        render(<MoneriumBankFlow onClose={vi.fn()} />);

        fireEvent.click(screen.getByText("monerium.bankFlow.blocked.cta"));
        expect(mocks.openExternalUrl).toHaveBeenCalledWith(
            MONERIUM_PORTAL_URL.production
        );
    });

    test.for([
        ["none", "connect:info"],
        ["reauth_required", "connect:reconnect"],
    ] as const)("a %s connection opens %s", ([connection, marker]) => {
        mocks.status.current = moneriumStatus({ connection, profile: null });
        render(<MoneriumBankFlow onClose={vi.fn()} />);
        expect(screen.getByText(marker)).toBeTruthy();
    });

    test("the success screen marks the setup success as seen", () => {
        moneriumStore.getState().reset();
        render(<MoneriumBankFlow onClose={vi.fn()} />);

        fireEvent.click(screen.getByText("monerium.bankFlow.success.cta"));
        expect(moneriumStore.getState().hasSeenSetupSuccess).toBe(true);
    });

    test.for(["transfer-amount", "transfer-recap", "transfer-iban"] as const)(
        "the %s step renders once setup is done",
        (step) => {
            moneriumFlowStore.getState().goTo(step);
            render(<MoneriumBankFlow onClose={vi.fn()} />);
            expect(screen.getByText(step)).toBeTruthy();
        }
    );

    test("a transfer in progress is dropped when the status leaves the transfer screen", () => {
        moneriumFlowStore.setState({ amount: "50", screen: "transfer-recap" });
        const { rerender } = render(<MoneriumBankFlow onClose={vi.fn()} />);
        expect(moneriumFlowStore.getState().amount).toBe("50");

        mocks.status.current = needsLink;
        rerender(<MoneriumBankFlow onClose={vi.fn()} />);

        expect(screen.getByText("link")).toBeTruthy();
        expect(moneriumFlowStore.getState().amount).toBe("");
        expect(moneriumFlowStore.getState().screen).toBe("transfer-amount");
    });

    test("closing the flow drops the transfer in progress", () => {
        moneriumFlowStore.setState({ amount: "50" });
        const { unmount } = render(<MoneriumBankFlow onClose={vi.fn()} />);

        unmount();
        expect(moneriumFlowStore.getState().amount).toBe("");
    });
});
