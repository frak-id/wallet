import { describe, expect, test } from "vitest";
import { buildInstallUrl } from "./buildInstallUrl";

describe("buildInstallUrl", () => {
    const args = {
        baseUrl: "https://wallet.frak.id",
        merchantId: "merchant-1",
        clientId: "client-1",
    };

    test("builds the m=/a= URL with no fragment when there is no install proof", () => {
        const url = buildInstallUrl(args);

        expect(url).toBe(
            "https://wallet.frak.id/install?m=merchant-1&a=client-1"
        );
        expect(url).not.toContain("#");
        expect(url).not.toContain("p=the-install-proof");
    });

    test("appends the install proof as a #p= fragment, not a search param", () => {
        const url = buildInstallUrl({
            ...args,
            installProof: "the-install-proof",
        });

        expect(url).toBe(
            "https://wallet.frak.id/install?m=merchant-1&a=client-1#p=the-install-proof"
        );
        const [withoutFragment, fragment] = url.split("#");
        expect(new URL(withoutFragment).searchParams.has("p")).toBe(false);
        expect(fragment).toBe("p=the-install-proof");
    });

    test("encodes special characters in the install proof fragment", () => {
        const url = buildInstallUrl({
            ...args,
            installProof: "abc+def/=&#",
        });

        expect(url).toContain(`#p=${encodeURIComponent("abc+def/=&#")}`);
        expect(url).not.toContain("#p=abc+def/=&#");
    });

    test("encodes merchantId and clientId in the search params", () => {
        const url = buildInstallUrl({
            baseUrl: "https://wallet.frak.id",
            merchantId: "merchant with space",
            clientId: "client&id",
        });

        expect(url).toBe(
            "https://wallet.frak.id/install?m=merchant%20with%20space&a=client%26id"
        );
    });
});
