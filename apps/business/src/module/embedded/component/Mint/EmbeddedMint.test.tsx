import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Search params are swapped per test; the component throws without `d`/`sc`.
let searchValue: Record<string, unknown> = {};
vi.mock("@tanstack/react-router", () => ({
    useSearch: () => searchValue,
}));

// `t` echoes the key; `Trans` echoes its key + interpolated domain so we can
// assert the domain is rendered (and that markup interpolation doesn't leak).
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: ({
        i18nKey,
        values,
    }: {
        i18nKey: string;
        values?: { domain?: string };
    }) => `${i18nKey} ${values?.domain ?? ""}`,
}));

// Domain-setup result is swapped per test to drive the three render branches.
let domainSetup: { data: boolean | undefined; isLoading: boolean } = {
    data: undefined,
    isLoading: true,
};
const triggerMint = vi.fn();

vi.mock("@/module/dashboard/hooks/dnsRecordHooks", () => ({
    useListenToDomainNameSetup: () => domainSetup,
}));

vi.mock("@/module/dashboard/hooks/useMintMyMerchant", () => ({
    useRegisterMerchant: () => ({
        infoTxt: "embedded.mint.registering",
        mutation: { mutate: triggerMint, isPending: false, error: null },
    }),
}));

import { EmbeddedMint } from "./index";

describe("EmbeddedMint", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        searchValue = {
            d: "test.com",
            sc: "setup-code",
            n: "Test Shop",
            c: "eure",
            sd: undefined,
        };
        domainSetup = { data: undefined, isLoading: true };
    });

    it("renders a spinner while the domain setup is loading", () => {
        domainSetup = { data: undefined, isLoading: true };
        render(<EmbeddedMint />);

        // Title is always shown; the mint CTA and error alert are not yet.
        expect(screen.getByText("embedded.mint.title")).toBeInTheDocument();
        expect(
            screen.queryByText("embedded.mint.register")
        ).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("renders the register CTA (with the domain) when the domain is valid", () => {
        domainSetup = { data: true, isLoading: false };
        render(<EmbeddedMint />);

        expect(
            screen.getByRole("button", { name: "embedded.mint.register" })
        ).toBeInTheDocument();
        // The <Trans> domain interpolation renders the raw domain, not markup.
        expect(screen.getByText(/test\.com/)).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("renders the error alert + close action when the domain is invalid", () => {
        domainSetup = { data: false, isLoading: false };
        render(<EmbeddedMint />);

        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("embedded.mint.error")).toBeInTheDocument();
        expect(
            screen.getByText("embedded.mint.alreadyRegistered")
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "embedded.mint.close" })
        ).toBeInTheDocument();
        expect(
            screen.queryByText("embedded.mint.register")
        ).not.toBeInTheDocument();
    });
});
