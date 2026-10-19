import { fireEvent, render, screen } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { GameRules } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, values?: Record<string, string>) =>
            values ? `${key} ${JSON.stringify(values)}` : key,
        i18n: { language: "fr-FR" },
    }),
    Trans: ({
        i18nKey,
        values,
        components,
    }: {
        i18nKey: string;
        values: Record<string, string>;
        components: { igLink: ReactElement };
    }) => (
        <>
            {`${i18nKey} ${JSON.stringify(values)}`}
            {cloneElement(components.igLink, {}, "@frak_fr")}
        </>
    ),
}));

describe("GameRules", () => {
    it("formats the reward and prize amounts in the three rows", () => {
        render(<GameRules onContinue={vi.fn()} />);

        expect(screen.getByText(/rules\.unlock\.title/).textContent).toMatch(
            /"1\s€"/
        );
        const invite = screen.getByText(/rules\.invite\.description/);
        expect(invite.textContent).toMatch(/"1\s€"/);
        expect(invite.textContent).toMatch(/"100\s€"/);
        expect(
            screen.getByText(/rules\.follow\.description/).textContent
        ).toMatch(/"100\s€"/);
    });

    it("links the follow row to Frak's Instagram account", () => {
        render(<GameRules onContinue={vi.fn()} />);

        expect(screen.getByRole("link", { name: "@frak_fr" })).toHaveAttribute(
            "href",
            "https://www.instagram.com/frak_fr/"
        );
    });

    it("continues from the footer and has no back arrow", () => {
        const onContinue = vi.fn();
        render(<GameRules onContinue={onContinue} />);

        fireEvent.click(
            screen.getByRole("button", { name: "onboarding.continue" })
        );

        expect(onContinue).toHaveBeenCalled();
        expect(
            screen.queryByRole("button", { name: "common.back" })
        ).not.toBeInTheDocument();
    });
});
