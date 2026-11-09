import { describe, expect, it } from "vitest";
import type { ReviewTrigger } from "@/module/stores/reviewPromptStore";
import { shouldAskForReview } from "./reviewDecision";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const MOMENTS: ReviewTrigger[] = ["game_win", "game_tickets", "game_joined"];
const ALL: ReviewTrigger[] = [...MOMENTS, "app_launch"];

describe("shouldAskForReview", () => {
    it.each(ALL)("%s never asks during the first launch", (trigger) => {
        for (const launchCount of [0, 1]) {
            expect(
                shouldAskForReview(
                    { launchCount, lastAskedAt: null },
                    trigger,
                    NOW
                )
            ).toBe(false);
        }
    });

    it.each(ALL)(
        "%s asks from the second launch when never asked",
        (trigger) => {
            for (const launchCount of [2, 40]) {
                expect(
                    shouldAskForReview(
                        { launchCount, lastAskedAt: null },
                        trigger,
                        NOW
                    )
                ).toBe(true);
            }
        }
    );

    it.each(MOMENTS)("%s skips inside the 30-day gap", (trigger) => {
        for (const lastAskedAt of [NOW, NOW - 29 * DAY]) {
            expect(
                shouldAskForReview(
                    { launchCount: 5, lastAskedAt },
                    trigger,
                    NOW
                )
            ).toBe(false);
        }
    });

    it.each(MOMENTS)("%s asks again once the gap is 30 days", (trigger) => {
        for (const lastAskedAt of [NOW - 30 * DAY, NOW - 400 * DAY]) {
            expect(
                shouldAskForReview(
                    { launchCount: 5, lastAskedAt },
                    trigger,
                    NOW
                )
            ).toBe(true);
        }
    });

    it("app_launch skips as soon as an ask happened, whatever the gap", () => {
        for (const lastAskedAt of [NOW, NOW - 30 * DAY, NOW - 400 * DAY]) {
            expect(
                shouldAskForReview(
                    { launchCount: 5, lastAskedAt },
                    "app_launch",
                    NOW
                )
            ).toBe(false);
        }
    });
});
