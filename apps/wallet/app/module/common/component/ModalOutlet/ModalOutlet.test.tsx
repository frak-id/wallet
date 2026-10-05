import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as overlayStyles from "@/module/common/styles/detailOverlay.css";
import { modalErrorStore } from "@/module/stores/modalErrorStore";
import { modalStore } from "@/module/stores/modalStore";
import { ModalOutlet } from "./index";

const { recordErrorMock } = vi.hoisted(() => ({ recordErrorMock: vi.fn() }));

vi.mock("@frak-labs/app-essentials/utils/platform", async () => ({
    ...(await vi.importActual("@frak-labs/app-essentials/utils/platform")),
    IS_TAURI: true,
    IS_IOS: true,
}));

vi.mock("@frak-labs/wallet-shared", async () => {
    const actual = await vi.importActual("@frak-labs/wallet-shared");
    return {
        ...actual,
        recordError: recordErrorMock,
        getInvoke: async () => async () => undefined,
    };
});

vi.mock("@/module/history/component/RewardDetailModal", () => ({
    RewardDetailModal: () => <div>reward-detail</div>,
}));

vi.mock("@/module/history/component/MoneriumOrderDetailModal", () => ({
    MoneriumOrderDetailModal: () => <div>monerium-order</div>,
}));

vi.mock("@/module/monerium/component/MoneriumBankFlow", () => ({
    MoneriumBankFlow: () => <div>monerium-bank-flow</div>,
}));

vi.mock("@/module/referral/component/EditReferralCodeSheet", () => ({
    EditReferralCodeSheet: () => <div>edit-referral-code</div>,
}));

// Stands in for a modal whose chunk 404s after a deploy: the failure the
// boundary exists to contain.
vi.mock("@/module/tokens/component/EmptyTransferModal", () => ({
    EmptyTransferModal: () => {
        throw new Error("Failed to fetch dynamically imported module");
    },
}));

vi.mock("@/module/tokens/component/TransferModal", () => ({
    TransferModal: () => <div>transfer-modal</div>,
}));

vi.mock("@/module/wallet/component/WelcomeCard/WelcomeDetail", () => ({
    WelcomeDetail: ({ onClose }: { onClose: () => void }) => (
        <button type="button" onClick={onClose}>
            close-welcome
        </button>
    ),
}));

vi.mock("@/module/explorer/component/ExplorerDetail", () => ({
    ExplorerDetail: ({ onClose }: { onClose: () => void }) => (
        <button type="button" onClick={onClose}>
            close-explorer
        </button>
    ),
}));

function closeDialog(button: HTMLElement) {
    act(() => {
        fireEvent.click(button);
        fireEvent.animationEnd(screen.getByRole("dialog"));
    });
}

describe("ModalOutlet", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        modalErrorStore.setState({ raised: false });
        modalStore.setState({ modal: null, stack: [] });
    });

    afterEach(() => {
        modalStore.setState({ modal: null, stack: [] });
    });

    it("renders a healthy modal without raising the failure toast", () => {
        modalStore.getState().openModal({ id: "transfer" });
        render(<ModalOutlet />);

        expect(screen.getByText("transfer-modal")).toBeInTheDocument();
        expect(modalErrorStore.getState().raised).toBe(false);
        expect(recordErrorMock).not.toHaveBeenCalled();
    });

    it("closes the modal and raises the toast when it cannot load", () => {
        modalStore.getState().openModal({ id: "emptyTransfer" });
        render(<ModalOutlet />);

        expect(modalStore.getState().modal).toBeNull();
        expect(modalErrorStore.getState().raised).toBe(true);
    });

    it("reports the failure once, under the boundary source", () => {
        modalStore.getState().openModal({ id: "emptyTransfer" });
        render(<ModalOutlet />);

        expect(recordErrorMock).toHaveBeenCalledTimes(1);
        expect(recordErrorMock).toHaveBeenCalledWith(expect.any(Error), {
            source: "error_boundary",
            context: { stage: "modal_load", modal_id: "emptyTransfer" },
        });
    });

    it("leaves nothing of the broken modal on screen", () => {
        modalStore.getState().openModal({ id: "emptyTransfer" });
        const { container } = render(<ModalOutlet />);

        expect(container).toBeEmptyDOMElement();
    });

    it("lets the surviving overlay close after one stacked over it closes", async () => {
        modalStore.getState().openModal({ id: "welcomeDetail" });
        render(<ModalOutlet />);
        await screen.findByText("close-welcome");

        act(() => {
            modalStore
                .getState()
                .openModal({ id: "explorerDetail", merchant: {} as never });
        });
        closeDialog(await screen.findByText("close-explorer"));
        expect(modalStore.getState().modal?.id).toBe("welcomeDetail");

        closeDialog(await screen.findByText("close-welcome"));
        expect(modalStore.getState().modal).toBeNull();
    });

    it.each([
        ["explorerDetail", "close-explorer", true],
        ["welcomeDetail", "close-welcome", true],
        ["rewardDetail", "reward-detail", true],
        ["moneriumOrderDetail", "monerium-order", true],
        ["moneriumBankFlow", "monerium-bank-flow", false],
        ["editReferralCode", "edit-referral-code", false],
    ])("%s overlay has swipe-to-close: %s", async (id, text, swipeable) => {
        const merchant = { id: "merchant-1" };
        modalStore
            .getState()
            .openModal({ id, merchant, item: { merchant } } as never);
        render(<ModalOutlet />);
        await screen.findByText(text);

        expect(
            screen
                .getByRole("dialog")
                .classList.contains(overlayStyles.swipeable)
        ).toBe(swipeable);
    });
});
