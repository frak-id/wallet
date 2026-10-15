import * as en from "@frak-labs/wallet-shared/i18n/locales/en";
import * as fr from "@frak-labs/wallet-shared/i18n/locales/fr";
import { act, render, screen, within } from "@testing-library/react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./index";

vi.mock("@tanstack/react-router", async () => {
    const actual = await vi.importActual("@tanstack/react-router");
    return {
        ...actual,
        Outlet: () => null,
        useRouterState: () => "/wallet",
        Link: ({ children, to }: { children?: unknown; to?: string }) => (
            <a href={to}>{children as React.ReactNode}</a>
        ),
    };
});

function Boom(): never {
    throw new Error("boom");
}

describe("AppShell error containment", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("keeps the shell's chrome mounted when content throws", () => {
        const { container } = render(
            <AppShell navigation={true}>
                <Boom />
            </AppShell>
        );

        // The fallback replaced the main region, not the shell around it.
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(container.querySelector("main")).toBeInTheDocument();
        expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("contains the throw without a tab bar to fall back on", () => {
        const { container } = render(
            <AppShell navigation={false}>
                <Boom />
            </AppShell>
        );

        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(container.querySelector("main")).toBeInTheDocument();
        expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("leaves healthy content alone", () => {
        render(
            <AppShell navigation={true}>
                <p>content</p>
            </AppShell>
        );

        expect(screen.getByText("content")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});

describe("AppShell tab labels", () => {
    it("follow the active language", async () => {
        const i18n = i18next.createInstance();
        await i18n.use(initReactI18next).init({
            lng: "en",
            resources: {
                en: { translation: en.translation },
                fr: { translation: fr.translation },
            },
        });
        render(
            <I18nextProvider i18n={i18n}>
                <AppShell navigation={true}>
                    <p>content</p>
                </AppShell>
            </I18nextProvider>
        );
        const tabNames = () =>
            within(screen.getByRole("navigation"))
                .getAllByRole("link")
                .map((link) => link.textContent);

        expect(tabNames()).toEqual(["Wallet", "Explorer", "Profile"]);

        await act(() => i18n.changeLanguage("fr"));

        expect(tabNames()).toEqual(["Porte-monnaie", "Explorer", "Profil"]);
    });
});
