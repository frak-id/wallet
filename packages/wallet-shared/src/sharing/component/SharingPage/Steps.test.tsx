import { render, screen } from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it } from "vitest";
import en from "../../../i18n/locales/en/customized.json";
import { getStep2Context, Steps } from "./Steps";
import type { SharingReward } from "./types";

// real i18next against the real locale file: a stub `t` would not reproduce the
// context fallback these tests are about
beforeAll(async () => {
    await i18next.use(initReactI18next).init({
        lng: "en",
        resources: { en: { translation: en } },
        interpolation: { escapeValue: false },
    });
});

const t = (key: string, options?: Record<string, unknown>) =>
    i18next.t(key, options ?? {}) as string;

const ready = (extra: Partial<Extract<SharingReward, { status: "ready" }>>) =>
    ({ status: "ready", ...extra }) as SharingReward;

describe("getStep2Context", () => {
    it("is undefined for a plain reward", () => {
        expect(getStep2Context(false, undefined)).toBeUndefined();
    });

    it("selects min when a minimum applies", () => {
        expect(getStep2Context(false, "10 €")).toBe("min");
    });

    it("selects product when scoped to products", () => {
        expect(getStep2Context(true, undefined)).toBe("product");
    });

    it("selects min_product when both apply — contexts do not compose", () => {
        expect(getStep2Context(true, "10 €")).toBe("min_product");
    });
});

describe("Steps", () => {
    it("renders a title and a description per step, from separate keys", () => {
        render(<Steps reward={{ status: "loading" }} t={t} />);

        expect(screen.getByText("Share in 1 click.")).toBeInTheDocument();
        expect(
            screen.getByText(
                "A personal link is automatically generated with each share."
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText("Collect your earnings in the app.")
        ).toBeInTheDocument();
    });

    it("keeps a period inside the copy out of the title", () => {
        render(
            <Steps reward={ready({ minPurchaseAmount: "10.50 €" })} t={t} />
        );

        expect(
            screen.getByText(
                "Every order of at least 10.50 € placed through your link earns you cash."
            )
        ).toBeInTheDocument();
    });

    it("falls back to the base title when only the description varies", () => {
        // `title_min` deliberately does not exist; only `description_min` is translated
        render(<Steps reward={ready({ minPurchaseAmount: "10 €" })} t={t} />);

        expect(screen.getByText("Earn on every purchase.")).toBeInTheDocument();
    });

    it("uses the product variant of both title and description", () => {
        render(<Steps reward={ready({ isProductScoped: true })} t={t} />);

        expect(
            screen.getByText("Earn on every purchase of selected products.")
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                "Every qualifying order placed through your link earns you cash."
            )
        ).toBeInTheDocument();
    });

    it("interpolates the minimum into the combined variant", () => {
        render(
            <Steps
                reward={ready({
                    isProductScoped: true,
                    minPurchaseAmount: "25 €",
                })}
                t={t}
            />
        );

        expect(
            screen.getByText(
                "Earn on every purchase of selected products of at least 25 €."
            )
        ).toBeInTheDocument();
    });

    it("appends the lockup note as an extra line on step 3", () => {
        render(<Steps reward={ready({ lockupDurationDays: 30 })} t={t} />);

        expect(
            screen.getByText("Install FRAK to collect your earnings.")
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                "Your earnings will be available 30 days after the purchase is confirmed."
            )
        ).toBeInTheDocument();
    });

    it("omits the lockup note when there is no lockup", () => {
        render(<Steps reward={ready({})} t={t} />);

        expect(screen.queryByText(/will be available/)).not.toBeInTheDocument();
    });
});
