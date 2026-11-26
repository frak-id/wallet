import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import {
    _resetI18nOverrideQueueForTests,
    drainPendingI18nOverrides,
    enqueueI18nOverride,
    enqueueLanguageChange,
} from "./i18nOverrideQueue";

describe("i18nOverrideQueue", () => {
    const apply = vi.fn(async () => {});

    beforeEach(() => {
        _resetI18nOverrideQueueForTests();
        apply.mockClear();
    });

    test("holds entries until drained, then applies them once in order", () => {
        enqueueI18nOverride({ "app.title": "Hello" });
        enqueueLanguageChange("fr");
        expect(apply).not.toHaveBeenCalled();

        drainPendingI18nOverrides(apply);

        expect(apply.mock.calls).toEqual([
            [{ kind: "override", payload: { "app.title": "Hello" } }],
            [{ kind: "language", payload: "fr" }],
        ]);
    });

    test("applies immediately once drained", () => {
        drainPendingI18nOverrides(apply);

        enqueueLanguageChange("fr");

        expect(apply).toHaveBeenCalledExactlyOnceWith({
            kind: "language",
            payload: "fr",
        });
    });

    test("a second drain does not replay entries already applied", () => {
        enqueueLanguageChange("fr");

        drainPendingI18nOverrides(apply);
        drainPendingI18nOverrides(apply);

        expect(apply).toHaveBeenCalledTimes(1);
    });
});
