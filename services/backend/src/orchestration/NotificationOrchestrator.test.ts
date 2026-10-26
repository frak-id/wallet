import { describe, expect, it, vi } from "vitest";
import type { NotificationEvent } from "../domain/notifications/events";
import { NotificationOrchestrator } from "./NotificationOrchestrator";

const { on, warn } = vi.hoisted(() => ({ on: vi.fn(), warn: vi.fn() }));

vi.mock("@backend-infrastructure", () => ({
    eventEmitter: { on },
    log: { warn },
}));

function setup() {
    on.mockReset();
    const sendAndStore = vi.fn().mockResolvedValue(undefined);
    const findByIds = vi.fn().mockResolvedValue([{ id: "m-1", name: "Nike" }]);
    new NotificationOrchestrator(
        { sendAndStore } as never,
        { findByIds } as never,
        {} as never,
        {} as never
    ).registerListeners();
    const handle = on.mock.calls[0]?.[1] as (
        event: NotificationEvent
    ) => Promise<void>;
    return { handle, sendAndStore };
}

describe("NotificationOrchestrator game_won", () => {
    it("tells the winner the prize in their language and opens the wallet", async () => {
        const { handle, sendAndStore } = setup();

        await handle({ type: "game_won", wallet: "0xabc", prizeAmount: 50 });

        expect(sendAndStore).toHaveBeenCalledWith({
            wallets: ["0xabc"],
            type: "game_won",
            payload: {
                en: {
                    title: "You won the Frak Game!",
                    body: "Your €50 prize is on its way to your wallet.",
                    data: { url: expect.stringMatching(/^https:\/\/wallet/) },
                },
                fr: {
                    title: "Tu as gagné le Jeu Frak !",
                    body: expect.stringMatching(
                        /^Tes 50\s€ arrivent dans ton porte-monnaie\.$/
                    ),
                    data: { url: expect.stringMatching(/^https:\/\/wallet/) },
                },
            },
        });
    });

    it("keeps the cents of a prize that has some", async () => {
        const { handle, sendAndStore } = setup();

        await handle({ type: "game_won", wallet: "0xabc", prizeAmount: 12.5 });

        expect(sendAndStore.mock.calls[0]?.[0].payload.en.body).toBe(
            "Your €12.50 prize is on its way to your wallet."
        );
    });

    it("logs a failed send instead of throwing", async () => {
        const { handle, sendAndStore } = setup();
        sendAndStore.mockRejectedValue(new Error("fcm down"));

        await expect(
            handle({ type: "game_won", wallet: "0xabc", prizeAmount: 50 })
        ).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalled();
    });
});

describe("NotificationOrchestrator reward events", () => {
    it("names the merchant who rewarded the wallet", async () => {
        const { handle, sendAndStore } = setup();

        await handle({
            type: "reward_settled",
            notifications: [
                { wallets: ["0xabc"], merchantId: "m-1", rewardCount: 1 },
            ],
        });

        expect(sendAndStore).toHaveBeenCalledWith(
            expect.objectContaining({
                wallets: ["0xabc"],
                type: "reward_settled",
                payload: expect.objectContaining({
                    en: {
                        title: "Reward received!",
                        body: "Your reward from Nike is in your wallet.",
                    },
                }),
            })
        );
    });
});
