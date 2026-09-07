import { describe, expect, test } from "vitest";
import { buildInstallUrl, buildPlayStoreInstallUrl } from "./buildInstallUrl";

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
        const [withoutFragment, fragment] = String(url).split("#");
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

describe("buildInstallUrl same-origin", () => {
    test("omits the base when none is given", () => {
        expect(
            buildInstallUrl({ merchantId: "merchant-1", clientId: "client-1" })
        ).toBe("/install?m=merchant-1&a=client-1");
    });
});

describe("buildInstallUrl checkoutToken", () => {
    test("builds a token-only URL when there is no clientId", () => {
        expect(
            buildInstallUrl({
                baseUrl: "https://wallet.frak.id",
                merchantId: "merchant-1",
                checkoutToken: "tok-1",
            })
        ).toBe(
            "https://wallet.frak.id/install?m=merchant-1&checkoutToken=tok-1"
        );
    });

    test("carries the token as a search param, never a fragment", () => {
        const url = buildInstallUrl({
            merchantId: "merchant-1",
            checkoutToken: "tok-1",
            installProof: "the-install-proof",
        });

        const [withoutFragment, fragment] = String(url).split("#");
        expect(
            new URL(withoutFragment, "https://wallet.frak.id").searchParams.get(
                "checkoutToken"
            )
        ).toBe("tok-1");
        expect(fragment).toBe("p=the-install-proof");
    });

    test("keeps both credentials when both are known", () => {
        expect(
            buildInstallUrl({
                merchantId: "merchant-1",
                clientId: "client-1",
                checkoutToken: "tok-1",
            })
        ).toBe("/install?m=merchant-1&a=client-1&checkoutToken=tok-1");
    });

    test("encodes the token", () => {
        expect(
            buildInstallUrl({
                merchantId: "merchant-1",
                checkoutToken: "tok&1=2",
            })
        ).toBe(
            `/install?m=merchant-1&checkoutToken=${encodeURIComponent("tok&1=2")}`
        );
    });

    test("refuses to build a link carrying neither credential", () => {
        expect(buildInstallUrl({ merchantId: "merchant-1" })).toBeNull();
        expect(
            buildInstallUrl({
                merchantId: "merchant-1",
                installProof: "the-install-proof",
            })
        ).toBeNull();
    });

    test("builds a merchant-only link when the caller opts in", () => {
        expect(
            buildInstallUrl({
                merchantId: "merchant-1",
                allowCredentialless: true,
            })
        ).toBe("/install?m=merchant-1");
    });

    test("still carries the checkout token when the caller opts in", () => {
        expect(
            buildInstallUrl({
                merchantId: "merchant-1",
                checkoutToken: "tok-1",
                allowCredentialless: true,
            })
        ).toBe("/install?m=merchant-1&checkoutToken=tok-1");
    });
});

describe("buildPlayStoreInstallUrl", () => {
    const args = { merchantId: "merchant-1", anonymousId: "anon-1" };

    test("carries merchantId and anonymousId in the referrer", () => {
        const referrer = new URL(
            buildPlayStoreInstallUrl(args)
        ).searchParams.get("referrer");

        expect(new URLSearchParams(referrer ?? "").get("merchantId")).toBe(
            "merchant-1"
        );
        expect(new URLSearchParams(referrer ?? "").get("anonymousId")).toBe(
            "anon-1"
        );
        expect(new URLSearchParams(referrer ?? "").has("proof")).toBe(false);
    });

    test("appends the proof without moving the legacy keys", () => {
        const referrer = new URL(
            buildPlayStoreInstallUrl({ ...args, installProof: "the-proof" })
        ).searchParams.get("referrer");

        expect(referrer).toBe(
            "merchantId=merchant-1&anonymousId=anon-1&proof=the-proof"
        );
    });
});
