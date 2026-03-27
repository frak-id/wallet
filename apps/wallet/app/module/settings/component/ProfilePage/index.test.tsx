import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) =>
            (
                ({
                    "wallet.profile.pageTitle": "Profil",
                    "wallet.profile.lastConnection": "Dernière connexion",
                }) as Record<string, string>
            )[key] ??
            fallback ??
            key,
        i18n: { language: "fr" },
    }),
}));

vi.mock("@frak-labs/app-essentials", () => ({
    isRunningInProd: true,
}));

vi.mock("@/module/settings/component/ProfileIdentityCard", () => ({
    ProfileIdentityCard: () => <div>identity-card</div>,
}));

vi.mock("@/module/settings/component/ProfilePreferencesCard", () => ({
    ProfilePreferencesCard: () => <div>preferences-card</div>,
}));

vi.mock("@/module/settings/component/ProfileLinksCard", () => ({
    ProfileLinksCard: () => <div>links-card</div>,
}));

vi.mock("@/module/settings/component/PrivateKey", () => ({
    PrivateKey: () => null,
}));

vi.mock("@/module/pairing/component/PairingList", () => ({
    PairingList: () => null,
}));

describe("ProfilePage", () => {
    test("should render the redesigned profile sections and footer info", async ({
        freshAuthenticationStore,
    }) => {
        vi.stubEnv("APP_VERSION", "1.0.1");
        vi.resetModules();
        freshAuthenticationStore
            .getState()
            .setLastAuthenticationAt(new Date("2026-03-19T15:23:00").getTime());

        const { ProfilePage } = await import("./index");

        render(<ProfilePage />);

        expect(
            screen.getByRole("heading", { name: "Profil" })
        ).toBeInTheDocument();
        expect(screen.getByText("identity-card")).toBeInTheDocument();
        expect(screen.getByText("preferences-card")).toBeInTheDocument();
        expect(screen.getByText("links-card")).toBeInTheDocument();
        expect(screen.getByText("Version 1.0.1")).toBeInTheDocument();
        expect(screen.getByText("FRAK Labs")).toBeInTheDocument();
        expect(
            screen.getByText("Dernière connexion : 19 mars 2026 à 15:23")
        ).toBeInTheDocument();
    });

    test("should hide the version when the environment fallback is UNKNOWN", async ({
        freshAuthenticationStore,
    }) => {
        vi.stubEnv("APP_VERSION", "UNKNOWN");
        vi.resetModules();
        freshAuthenticationStore
            .getState()
            .setLastAuthenticationAt(new Date("2026-03-19T15:23:00").getTime());

        const { ProfilePage } = await import("./index");

        render(<ProfilePage />);

        expect(screen.queryByText("Version UNKNOWN")).not.toBeInTheDocument();
        expect(screen.getByText("FRAK Labs")).toBeInTheDocument();
    });
});
