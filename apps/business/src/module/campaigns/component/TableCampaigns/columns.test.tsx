import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `t` must be referentially stable: it is a dep of the memo under test, so a
// fresh identity per render would fail this for the wrong reason.
const t = (key: string) => key;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t }) }));

import { campaignSelectionStore } from "@/stores/campaignSelectionStore";
import { useCampaignColumns } from "./columns";

beforeEach(() => campaignSelectionStore.getState().clear());

describe("useCampaignColumns", () => {
    // Selection lives in CellSelect/HeaderSelect, not in this memo's deps. If it
    // leaks back in, every cell re-renders per click on an unpaginated table —
    // silently, since nothing about the UI looks wrong.
    it("returns identical column defs across a selection change", () => {
        const { result, rerender } = renderHook(() =>
            useCampaignColumns({ merchantId: "m1" })
        );
        const before = result.current;

        act(() => campaignSelectionStore.getState().toggle("c1"));
        rerender();

        expect(campaignSelectionStore.getState().selectedIds.has("c1")).toBe(
            true
        );
        expect(result.current).toBe(before);
    });
});
