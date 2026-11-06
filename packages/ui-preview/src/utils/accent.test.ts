import { describe, expect, it } from "vitest";
import { accentInk, accentVars } from "./accent";

describe("accentInk", () => {
    it.each([
        ["#ffd400", "#000"],
        ["#ffffff", "#000"],
        ["#b00020", "#fff"],
        ["#111111", "#fff"],
        ["#d209ec", "#fff"],
        ["#e90c0c", "#fff"],
        ["#16a34a", "#fff"],
        ["#ff6600", "#000"],
        ["#00a3ff", "#000"],
    ])("picks the readable ink for %s", (hex, ink) => {
        expect(accentInk(hex)).toBe(ink);
    });
});

describe("accentVars", () => {
    it("sets the accent and its ink", () => {
        expect(accentVars("#ffd400")).toEqual({
            "--frak-amb-accent": "#ffd400",
            "--frak-amb-accent-ink": "#000",
        });
    });

    it.each([undefined, "", "#fff", "red"])("leaves %j to the default", (v) => {
        expect(accentVars(v)).toBeUndefined();
    });
});
