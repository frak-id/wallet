import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ambassadorProxyPath } from "./ambassadorPage";
import { MENU_SCOPES, PAGE_SCOPES, PROXY_SCOPES } from "./optionalScopes";

const TOMLS = {
    production: "shopify.app.production.toml",
    development: "shopify.app.development.toml",
};

function readToml(file: string): string {
    return readFileSync(resolve(__dirname, "../..", file), "utf-8");
}

function optionalScopes(toml: string): string[] {
    const list = /^optional_scopes\s*=\s*\[([^\]]*)\]/m.exec(toml)?.[1] ?? "";
    return [...list.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function appProxySetting(toml: string, key: string): string | undefined {
    const section = /^\[app_proxy\]\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m.exec(
        toml
    )?.[1];
    return new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m").exec(
        section ?? ""
    )?.[1];
}

describe("optional scopes", () => {
    it.each(Object.values(TOMLS))(
        "%s declares exactly the page, proxy and menu scopes",
        (file) => {
            expect(optionalScopes(readToml(file)).sort()).toEqual(
                [...PAGE_SCOPES, ...PROXY_SCOPES, ...MENU_SCOPES].sort()
            );
        }
    );
});

describe("app proxy path", () => {
    const original = process.env.STAGE;
    afterEach(() => {
        if (original === undefined) delete process.env.STAGE;
        else process.env.STAGE = original;
    });

    it.each([
        ["production", TOMLS.production],
        ["dev", TOMLS.development],
    ])("matches the [app_proxy] of the %s toml", (stage, file) => {
        process.env.STAGE = stage;
        const toml = readToml(file);
        const path = `/${appProxySetting(toml, "prefix")}/${appProxySetting(toml, "subpath")}`;
        expect(path).toBe(ambassadorProxyPath());
    });

    it("points production at the sdk.frak.id origin", () => {
        expect(appProxySetting(readToml(TOMLS.production), "url")).toBe(
            "https://sdk.frak.id/shopify/ambassador"
        );
    });
});
