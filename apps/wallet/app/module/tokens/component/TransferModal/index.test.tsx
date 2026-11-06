/** @jsxImportSource react */
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { modalStore } from "@/module/stores/modalStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({ rampEnabled: { current: true } }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/module/ramp/utils/rampConfig", () => ({
    get isRampEnabled() {
        return mocks.rampEnabled.current;
    },
}));

import { TransferModal } from "./index";

const RAMP_ROW = "wallet.transferModal.ramp";

describe("TransferModal", () => {
    beforeEach(() => {
        modalStore.setState({ modal: null, stack: [] });
        mocks.rampEnabled.current = true;
    });

    test("hides the Ramp row without a Ramp key", () => {
        mocks.rampEnabled.current = false;
        render(<TransferModal onClose={vi.fn()} />);

        expect(screen.queryByText(RAMP_ROW)).toBeNull();
        expect(
            screen.getByText("wallet.transferModal.bankAccount")
        ).toBeTruthy();
    });

    test("the Ramp row closes the picker and opens the Ramp flow", () => {
        const onClose = vi.fn();
        render(<TransferModal onClose={onClose} />);

        fireEvent.click(screen.getByText(RAMP_ROW));

        expect(onClose).toHaveBeenCalled();
        expect(modalStore.getState().modal).toEqual({
            id: "rampOfframpFlow",
        });
    });
});
