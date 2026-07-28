import { afterEach, describe, expect, it } from "vitest";
import { isProd } from "./env";

describe("isProd", () => {
    const original = process.env.STAGE;
    afterEach(() => {
        if (original === undefined) delete process.env.STAGE;
        else process.env.STAGE = original;
    });

    it.each(["production", "gcp-production", "prod"])(
        "is true for %s",
        (stage) => {
            process.env.STAGE = stage;
            expect(isProd()).toBe(true);
        }
    );

    it.each(["staging", "dev", "gcp-dev", ""])("is false for %s", (stage) => {
        process.env.STAGE = stage;
        expect(isProd()).toBe(false);
    });

    it("is false when STAGE is unset", () => {
        delete process.env.STAGE;
        expect(isProd()).toBe(false);
    });
});
