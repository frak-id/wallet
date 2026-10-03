import { afterEach, describe, expect, it } from "vitest";
import {
    ambassadorMenuTitle,
    ambassadorPageLanguage,
    ambassadorProxyPath,
    scopesForIntent,
} from "./ambassadorPage";

describe("ambassadorProxyPath", () => {
    const original = process.env.STAGE;
    afterEach(() => {
        if (original === undefined) delete process.env.STAGE;
        else process.env.STAGE = original;
    });

    it("is /apps/ambassador in production", () => {
        process.env.STAGE = "production";
        expect(ambassadorProxyPath()).toBe("/apps/ambassador");
    });

    it("is /apps/ambassador-dev on any other stage", () => {
        process.env.STAGE = "dev";
        expect(ambassadorProxyPath()).toBe("/apps/ambassador-dev");
    });
});

describe("scopesForIntent", () => {
    it("asks for the proxy scope alone to publish without the menu link", () => {
        expect(scopesForIntent("publish", { addToMenu: false })).toEqual([
            "write_app_proxy",
        ]);
    });

    it("adds the navigation scope to publish with the menu link", () => {
        expect(scopesForIntent("publish", { addToMenu: true })).toEqual([
            "write_app_proxy",
            "write_online_store_navigation",
        ]);
    });

    it("asks for the navigation scope only to add the menu link", () => {
        expect(scopesForIntent("addToMenu", { addToMenu: true })).toEqual([
            "write_online_store_navigation",
        ]);
    });

    it("asks for nothing to hide", () => {
        expect(scopesForIntent("hide", { addToMenu: true })).toEqual([]);
    });

    it("asks for proxy, navigation and page scopes to switch", () => {
        expect(scopesForIntent("switch", { addToMenu: false })).toEqual([
            "write_app_proxy",
            "write_online_store_navigation",
            "read_online_store_pages",
            "write_online_store_pages",
        ]);
    });
});

describe("ambassadorPageLanguage", () => {
    it.each([
        ["fr", "fr"],
        ["fr-CA", "fr"],
        ["FR", "fr"],
        ["en", "en"],
        ["de", "en"],
        [null, "en"],
    ] as const)("reads %s as %s", (value, language) => {
        expect(ambassadorPageLanguage(value)).toBe(language);
    });
});

describe("ambassadorMenuTitle", () => {
    it("is the French title for fr and the English one otherwise", () => {
        expect(ambassadorMenuTitle("fr")).toBe("Devenir ambassadeur");
        expect(ambassadorMenuTitle("en")).toBe("Become an ambassador");
    });
});
