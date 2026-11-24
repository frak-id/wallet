import { describe, expect, it } from "vitest";
import { postHogDefines } from "./posthog.ts";

describe("postHogDefines", () => {
    it("bakes the host and token for a production build", () => {
        expect(postHogDefines(true)).toEqual({
            "process.env.POSTHOG_HOST": '"https://e.frak.id"',
            "process.env.POSTHOG_TOKEN": expect.stringMatching(/^"phc_\w+"$/),
        });
    });

    it("leaves both undefined otherwise", () => {
        expect(postHogDefines(false)).toEqual({
            "process.env.POSTHOG_HOST": "undefined",
            "process.env.POSTHOG_TOKEN": "undefined",
        });
    });
});
