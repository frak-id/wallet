import { beforeEach, describe, expect, test } from "vitest";
import { moneriumFlowStore } from "./moneriumFlowStore";

const INTENT = "10:FR7630006000011234567890189";

describe("moneriumFlowStore.orderIdFor", () => {
    beforeEach(() => moneriumFlowStore.getState().resetTransfer());

    test("keeps the id across retries and screen changes for the same intent", () => {
        const { orderIdFor, goTo } = moneriumFlowStore.getState();
        const first = orderIdFor(INTENT);
        goTo("transfer-amount");
        goTo("transfer-recap");
        expect(orderIdFor(INTENT)).toBe(first);
    });

    test("mints a new id when the amount or IBAN changes", () => {
        const { orderIdFor } = moneriumFlowStore.getState();
        const first = orderIdFor(INTENT);
        expect(orderIdFor("11:FR7630006000011234567890189")).not.toBe(first);
    });

    test("mints a new id after a reset or a settled order", () => {
        const { orderIdFor, resetTransfer, forgetOrderId } =
            moneriumFlowStore.getState();
        const first = orderIdFor(INTENT);
        resetTransfer();
        const second = orderIdFor(INTENT);
        expect(second).not.toBe(first);
        forgetOrderId();
        expect(orderIdFor(INTENT)).not.toBe(second);
    });
});
