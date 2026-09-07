import { describe, expect, test } from "@/tests/vitest-fixtures";
import { parseInstallFragment } from "./fragment";

describe("parseInstallFragment", () => {
    test("returns null when there is no fragment", () => {
        expect(parseInstallFragment("")).toBeNull();
        expect(parseInstallFragment("#")).toBeNull();
    });

    test("parses the initial-load shape: p, sid, probe", () => {
        expect(
            parseInstallFragment("#p=proof-1&sid=session-1&probe=ok")
        ).toEqual({ p: "proof-1", sid: "session-1", probe: "ok" });
    });

    test("parses the detection rewrite: installed, dt, via alongside the rest", () => {
        expect(
            parseInstallFragment(
                "#p=proof-1&sid=session-1&probe=ok&installed=1&dt=4200&via=overlay"
            )
        ).toEqual({
            p: "proof-1",
            sid: "session-1",
            probe: "ok",
            installed: "1",
            dt: 4200,
            via: "overlay",
        });
    });

    test("omits absent keys rather than setting them to undefined", () => {
        const activation = parseInstallFragment("#sid=session-1");
        expect(activation).toEqual({ sid: "session-1" });
        expect(Object.hasOwn(activation ?? {}, "installed")).toBe(false);
    });

    test("rejects an out-of-set probe or via value", () => {
        expect(parseInstallFragment("#probe=unknown")).toEqual({});
        expect(parseInstallFragment("#via=totally-not-a-surface")).toEqual({});
    });

    test("rejects installed unless it is exactly the string '1'", () => {
        expect(parseInstallFragment("#installed=true")).toEqual({});
        expect(parseInstallFragment("#installed=0")).toEqual({});
    });

    test("parses dt as an integer and drops a non-numeric one", () => {
        expect(parseInstallFragment("#dt=120")).toEqual({ dt: 120 });
        expect(parseInstallFragment("#dt=not-a-number")).toEqual({});
    });

    test("accepts the fragment with or without the leading '#'", () => {
        expect(parseInstallFragment("sid=session-1")).toEqual({
            sid: "session-1",
        });
    });

    test("never throws on pathological input", () => {
        expect(() => parseInstallFragment("#%%%invalid%%%")).not.toThrow();
        expect(() => parseInstallFragment("#=====")).not.toThrow();
    });
});
