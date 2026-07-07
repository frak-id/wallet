import { beforeEach, describe, expect, test } from "vitest";
import {
    DEFAULT_EXPLORER_SORT,
    explorerSortStore,
    isCustomExplorerSort,
} from "./explorerSortStore";

describe("explorerSortStore", () => {
    beforeEach(() => {
        explorerSortStore.getState().setSort(DEFAULT_EXPLORER_SORT);
    });

    test("defaults to the recommended sort", () => {
        expect(explorerSortStore.getState().sort).toBe("recommended");
        expect(DEFAULT_EXPLORER_SORT).toBe("recommended");
    });

    test("setSort updates the applied sort", () => {
        explorerSortStore.getState().setSort("reward");
        expect(explorerSortStore.getState().sort).toBe("reward");
    });

    describe("isCustomExplorerSort", () => {
        test("is false for the default sort", () => {
            expect(isCustomExplorerSort("recommended")).toBe(false);
        });

        test("is true for every non-default sort", () => {
            expect(isCustomExplorerSort("popular")).toBe(true);
            expect(isCustomExplorerSort("reward")).toBe(true);
            expect(isCustomExplorerSort("expiring")).toBe(true);
            expect(isCustomExplorerSort("recent")).toBe(true);
        });
    });
});
