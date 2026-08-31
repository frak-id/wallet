import { describe, expect, test, vi } from "vitest";
import { modalStore } from "./modalStore";

/**
 * Exits settle on the microtask queue, so assertions await one turn rather
 * than a wall-clock delay.
 */
const settle = () => Promise.resolve();

function reset() {
    modalStore.setState({ modal: null, stack: [] });
}

describe("modalStore — opener-owned exits", () => {
    test("dismissal runs the exit and clears the modal", async () => {
        reset();
        const onExit = vi.fn();
        modalStore.getState().openModal({ id: "recoveryCodeSuccess", onExit });

        modalStore.getState().closeModal();
        await settle();

        expect(onExit).toHaveBeenCalledTimes(1);
        expect(modalStore.getState().modal).toBeNull();
    });

    test("an exit that opens another modal is not clobbered by the update", async () => {
        reset();
        modalStore.getState().openModal({
            id: "recoveryCodeSuccess",
            onExit: () => modalStore.getState().openModal({ id: "transfer" }),
        });

        modalStore.getState().closeModal();
        await settle();

        expect(modalStore.getState().modal?.id).toBe("transfer");
    });

    test("re-opening the same modal runs the outgoing exit", async () => {
        reset();
        const first = vi.fn();
        modalStore.getState().openModal({
            id: "recoveryCodeSuccess",
            onExit: first,
        });
        modalStore.getState().openModal({
            id: "recoveryCodeSuccess",
            onExit: vi.fn(),
        });
        await settle();

        expect(first).toHaveBeenCalledTimes(1);
    });

    test("an entry evicted by the depth cap still runs its exit", async () => {
        reset();
        const evicted = vi.fn();
        modalStore
            .getState()
            .openModal({ id: "recoveryCodeSuccess", onExit: evicted });

        // maxStackDepth is 5; six more pushes force the first one out.
        for (const id of [
            "transfer",
            "pendingGains",
            "emptyTransfer",
            "welcomeDetail",
            "moneriumBankFlow",
            "emptyPendingGains",
        ] as const) {
            modalStore.getState().openModal({ id });
        }
        await settle();

        expect(evicted).toHaveBeenCalledTimes(1);
    });

    test("popping back to a stacked modal leaves its exit unrun", async () => {
        reset();
        const onExit = vi.fn();
        modalStore.getState().openModal({ id: "recoveryCodeSuccess", onExit });
        modalStore.getState().openModal({ id: "transfer" });

        // Closing the top reveals the confirmation again — it was never
        // dismissed, so its exit is not owed yet.
        modalStore.getState().closeModal();
        await settle();

        expect(onExit).not.toHaveBeenCalled();
        expect(modalStore.getState().modal?.id).toBe("recoveryCodeSuccess");
    });

    test("a modal without an exit closes without incident", async () => {
        reset();
        modalStore.getState().openModal({ id: "transfer" });

        modalStore.getState().closeModal();
        await settle();

        expect(modalStore.getState().modal).toBeNull();
    });
});
