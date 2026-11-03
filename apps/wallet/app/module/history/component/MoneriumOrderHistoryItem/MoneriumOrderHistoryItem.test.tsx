import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { modalStore } from "@/module/stores/modalStore";
import { moneriumOrder } from "@/tests/moneriumFixtures";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";
import { MoneriumOrderHistoryItem } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
}));

describe("MoneriumOrderHistoryItem", () => {
    beforeEach(() => {
        modalStore.getState().dismissAll();
    });

    test("a pending payout shows its kind, state, masked IBAN and a negative amount", () => {
        render(
            <MoneriumOrderHistoryItem
                order={moneriumOrder({
                    counterpart: {
                        iban: "FR7630006000011234567890189",
                        own: true,
                    },
                    amount: "12.5",
                })}
            />
        );

        expect(screen.getByText("monerium.order.kind.redeem")).toBeTruthy();
        expect(screen.getByText("monerium.order.state.pending")).toBeTruthy();
        expect(screen.getByText(/•••• 0189/)).toBeTruthy();
        expect(screen.getByText(/^-.*12\.50/)).toBeTruthy();
    });

    test("a processed order shows no state label", () => {
        render(
            <MoneriumOrderHistoryItem
                order={moneriumOrder({ state: "processed", kind: "issue" })}
            />
        );

        expect(screen.queryByText(/^monerium\.order\.state\./)).toBeNull();
        expect(screen.getByText(/^\+/)).toBeTruthy();
    });

    test("tapping the row opens the order detail", () => {
        const order = moneriumOrder();
        render(<MoneriumOrderHistoryItem order={order} />);

        fireEvent.click(screen.getByRole("button"));

        expect(modalStore.getState().modal).toEqual({
            id: "moneriumOrderDetail",
            order,
        });
    });
});
