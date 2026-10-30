import { fireEvent, render, screen } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { FRAK_INSTAGRAM_URL } from "@/module/instagram/config";
import { GameRules } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, values?: Record<string, string>) =>
            values ? `${key} ${JSON.stringify(values)}` : key,
        i18n: { language: "fr-FR" },
    }),
    Trans: ({
        i18nKey,
        components,
    }: {
        i18nKey: string;
        components: { igLink: ReactElement };
    }) => (
        <>
            {i18nKey}
            {cloneElement(components.igLink, {}, "@frak_fr")}
        </>
    ),
}));

describe("GameRules", () => {
    it("shows the earned reward and what each side of an invite earns", () => {
        render(
            <GameRules
                reward={2.5}
                invite={{ referrer: 1, referee: 1 }}
                onContinue={vi.fn()}
            />
        );

        expect(screen.getByText(/bonus\.title/).textContent).toMatch(
            /"2,50\s€"/
        );
        expect(screen.getByText(/rules\.invite\.reward /).textContent).toMatch(
            /"1\s€"/
        );
    });

    it.each([
        {
            name: "different amounts per side",
            invite: { referrer: 2, referee: 1 },
            line: /rules\.invite\.rewardSplit .*"2\s€".*"1\s€"/,
        },
        {
            name: "no live signup reward",
            invite: undefined,
            line: /^onboarding\.game\.rules\.invite\.description$/,
        },
    ])("words the invite row for $name", ({ invite, line }) => {
        render(<GameRules reward={1} invite={invite} onContinue={vi.fn()} />);

        expect(screen.getByText(line)).toBeInTheDocument();
    });

    it("tags each way to earn with its tickets, the bonus as pending", () => {
        render(<GameRules reward={2} onContinue={vi.fn()} />);

        expect(
            screen.getByText("onboarding.game.bonus.pending")
        ).toBeInTheDocument();
        expect(
            screen.getByText('game.page.missions.reward {"count":2}')
        ).toBeInTheDocument();
        expect(
            screen.getByText('game.page.missions.rewardPerFriend {"count":1}')
        ).toBeInTheDocument();
        expect(
            screen.getByText("onboarding.game.rules.purchase.title")
        ).toBeInTheDocument();
        expect(
            screen.getByText('game.page.missions.rewardPerPurchase {"count":3}')
        ).toBeInTheDocument();
    });

    it("drops the unlock row when the join earned nothing", () => {
        render(<GameRules reward={0} onContinue={vi.fn()} />);

        expect(screen.queryByText(/game\.bonus/)).not.toBeInTheDocument();
        expect(screen.getByText(/rules\.invite\.title/)).toBeInTheDocument();
    });

    it("links the follow row to Frak's Instagram account", () => {
        render(<GameRules reward={1} onContinue={vi.fn()} />);

        expect(screen.getByRole("link", { name: "@frak_fr" })).toHaveAttribute(
            "href",
            FRAK_INSTAGRAM_URL
        );
    });

    it("continues from the footer and has no back arrow", () => {
        const onContinue = vi.fn();
        render(<GameRules reward={1} onContinue={onContinue} />);

        fireEvent.click(
            screen.getByRole("button", { name: "onboarding.continue" })
        );

        expect(onContinue).toHaveBeenCalled();
        expect(
            screen.queryByRole("button", { name: "common.back" })
        ).not.toBeInTheDocument();
    });
});
