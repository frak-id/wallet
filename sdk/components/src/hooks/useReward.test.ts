import type { InteractionTypeKey } from "@frak-labs/core-sdk";
import { renderHook, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as getCurrentReward from "@/utils/getCurrentReward";
import { useReward } from "./useReward";

// Mock getCurrentReward
vi.mock("@/utils/getCurrentReward", () => ({
    getCurrentReward: vi.fn(),
}));

describe("useReward", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return undefined reward initially", () => {
        const { result } = renderHook(() => useReward(false, undefined));

        expect(result.current.reward).toBeUndefined();
    });

    it("should not fetch reward when shouldUseReward is false", () => {
        renderHook(() => useReward(false, undefined));

        expect(getCurrentReward.getCurrentReward).not.toHaveBeenCalled();
    });

    it("should fetch reward when shouldUseReward is true", async () => {
        vi.mocked(getCurrentReward.getCurrentReward).mockResolvedValue(
            "10 eur"
        );

        const { result } = renderHook(() => useReward(true, undefined));

        await waitFor(() => {
            expect(getCurrentReward.getCurrentReward).toHaveBeenCalledWith({
                targetInteraction: undefined,
            });
        });

        await waitFor(() => {
            expect(result.current.reward).toBe("10 eur");
        });
    });

    it("should pass targetInteraction to getCurrentReward", async () => {
        vi.mocked(getCurrentReward.getCurrentReward).mockResolvedValue(
            "15 eur"
        );

        renderHook(() => useReward(true, "purchase"));

        await waitFor(() => {
            expect(getCurrentReward.getCurrentReward).toHaveBeenCalledWith({
                targetInteraction: "purchase",
            });
        });
    });

    it("should handle undefined reward response", async () => {
        vi.mocked(getCurrentReward.getCurrentReward).mockResolvedValue(
            undefined
        );

        const { result } = renderHook(() => useReward(true, undefined));

        await waitFor(() => {
            expect(getCurrentReward.getCurrentReward).toHaveBeenCalled();
        });

        // Reward should remain undefined
        expect(result.current.reward).toBeUndefined();
    });

    it("should refetch when targetInteraction changes", async () => {
        vi.mocked(getCurrentReward.getCurrentReward).mockResolvedValue(
            "10 eur"
        );

        type Props = { targetInteraction?: InteractionTypeKey };
        const { rerender } = renderHook(
            (props: Props) => useReward(true, props.targetInteraction),
            {
                initialProps: { targetInteraction: undefined } as Props,
            }
        );

        await waitFor(() => {
            expect(getCurrentReward.getCurrentReward).toHaveBeenCalledTimes(1);
        });

        rerender({ targetInteraction: "purchase" });

        await waitFor(() => {
            expect(getCurrentReward.getCurrentReward).toHaveBeenCalledTimes(2);
        });
    });
});
