/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { type IbanEntry, ibanStore } from "@/module/monerium/store/ibanStore";
import { moneriumFlowStore } from "@/module/monerium/store/moneriumFlowStore";
import { fail, ok } from "@/tests/moneriumFixtures";
import {
    beforeEach,
    describe,
    expect,
    test,
    type WalletTestFixtures,
} from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({ post: vi.fn(), sign: vi.fn() }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
}));
vi.mock("wagmi", () => ({
    useSignMessage: () => ({ mutateAsync: mocks.sign }),
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => ({
    ...(await importOriginal<typeof WalletShared>()),
    trackEvent: vi.fn(),
    authenticatedWalletApi: { monerium: { orders: { post: mocks.post } } },
}));

import { MoneriumTransferRecapScreen } from "./MoneriumTransferRecapScreen";

const MINE = "FR7630006000011234567890189";
const OTHER = "DE89370400440532013000";
const CONFIRM = "monerium.bankFlow.transfer.recap.confirm";

function entry(iban: string, own: boolean): IbanEntry {
    return {
        iban,
        firstName: own ? "" : "Ada",
        lastName: own ? "" : "Lovelace",
        pseudo: iban,
        own,
        country: own ? undefined : "DE",
    };
}

function renderRecap(queryWrapper: WalletTestFixtures["queryWrapper"]) {
    return render(<MoneriumTransferRecapScreen onClose={vi.fn()} />, {
        wrapper: queryWrapper.wrapper,
    });
}

const confirm = () =>
    fireEvent.click(screen.getByRole("button", { name: CONFIRM }));

const postedIds = () => mocks.post.mock.calls.map(([body]) => body.orderId);

describe("MoneriumTransferRecapScreen order id", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sign.mockResolvedValue("0xsig");
        ibanStore.setState({
            knownIbans: [entry(MINE, true), entry(OTHER, false)],
            lastUsedIban: MINE,
        });
        moneriumFlowStore.getState().resetTransfer();
        moneriumFlowStore.setState({ amount: "10" });
    });

    test("a retry after a failed placement posts the same order id", async ({
        queryWrapper,
    }) => {
        mocks.post
            .mockResolvedValueOnce(fail(503))
            .mockResolvedValueOnce(ok({ orderId: "x", order: null }));
        renderRecap(queryWrapper);

        confirm();
        await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
        await screen.findByText("monerium.errors.network");
        confirm();
        await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));

        const [first, second] = postedIds();
        expect(first).toBeTruthy();
        expect(second).toBe(first);
    });

    test("going back and continuing with the same transfer keeps the order id", async ({
        queryWrapper,
    }) => {
        mocks.post.mockResolvedValue(fail(503));
        const firstVisit = renderRecap(queryWrapper);
        confirm();
        await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
        firstVisit.unmount();

        renderRecap(queryWrapper);
        confirm();
        await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));

        const [first, second] = postedIds();
        expect(second).toBe(first);
    });

    test.for([
        ["the amount", () => moneriumFlowStore.setState({ amount: "20" })],
        ["the IBAN", () => ibanStore.setState({ lastUsedIban: OTHER })],
    ] as const)(
        "changing %s mints a new order id",
        async ([, change], { queryWrapper }) => {
            mocks.post.mockResolvedValue(fail(503));
            const firstVisit = renderRecap(queryWrapper);
            confirm();
            await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
            firstVisit.unmount();

            change();
            renderRecap(queryWrapper);
            confirm();
            await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));

            const [first, second] = postedIds();
            expect(second).not.toBe(first);
        }
    );

    test("the same amount typed differently keeps the order id", async ({
        queryWrapper,
    }) => {
        mocks.post.mockResolvedValue(fail(503));
        const firstVisit = renderRecap(queryWrapper);
        confirm();
        await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
        firstVisit.unmount();

        moneriumFlowStore.setState({ amount: "10,0" });
        renderRecap(queryWrapper);
        confirm();
        await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));

        const [first, second] = postedIds();
        expect(second).toBe(first);
    });

    test("a refused order is not replayed: the next attempt gets a new id", async ({
        queryWrapper,
    }) => {
        mocks.post
            .mockResolvedValueOnce(fail(422, "MONERIUM_ORDER_REJECTED"))
            .mockResolvedValueOnce(ok({ orderId: "x", order: null }));
        renderRecap(queryWrapper);

        confirm();
        await screen.findByText("monerium.errors.orderRejected");
        confirm();
        await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));

        const [first, second] = postedIds();
        expect(second).not.toBe(first);
    });

    test("an order that went through is not reused for the next transfer", async ({
        queryWrapper,
    }) => {
        mocks.post.mockResolvedValue(ok({ orderId: "x", order: null }));
        const firstVisit = renderRecap(queryWrapper);
        confirm();
        await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
        await waitFor(() =>
            expect(moneriumFlowStore.getState().orderId).toBeNull()
        );
        firstVisit.unmount();

        renderRecap(queryWrapper);
        confirm();
        await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));

        const [first, second] = postedIds();
        expect(second).not.toBe(first);
    });
});

describe("MoneriumTransferRecapScreen memo", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ibanStore.setState({
            knownIbans: [entry(MINE, true)],
            lastUsedIban: MINE,
        });
        moneriumFlowStore.getState().resetTransfer();
        moneriumFlowStore.setState({ amount: "10", note: "abc" });
    });

    test("a memo outside the limits blocks the confirmation and is announced", ({
        queryWrapper,
    }) => {
        renderRecap(queryWrapper);

        expect(
            screen
                .getByRole("button", { name: CONFIRM })
                .hasAttribute("disabled")
        ).toBe(true);
        const alert = screen.getByRole("alert");
        expect(alert.textContent).toBe(
            "monerium.bankFlow.transfer.recap.memoInvalid"
        );
        expect(
            screen
                .getByLabelText("monerium.bankFlow.transfer.recap.addNote")
                .getAttribute("aria-describedby")
        ).toBe(alert.id);
        expect(mocks.post).not.toHaveBeenCalled();
    });
});
