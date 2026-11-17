import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    trackEvent,
    copy,
    navigate,
    referral,
    clipboard,
    canShareNatively,
    shareNatively,
} = vi.hoisted(() => ({
    trackEvent: vi.fn(),
    copy: vi.fn(),
    navigate: vi.fn(),
    referral: {
        data: undefined as { ownedCode: { code: string } | null } | undefined,
    },
    clipboard: { copied: false },
    canShareNatively: vi.fn(),
    shareNatively: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, values?: Record<string, unknown>) =>
            values?.count === undefined ? key : `${key}:${values.count}`,
        i18n: { language: "fr-FR" },
    }),
}));
vi.mock("@frak-labs/wallet-shared", () => ({
    trackEvent,
    recordError: vi.fn(),
    canShareNatively,
    shareNatively,
    useReferralStatus: () => referral,
    useCopyToClipboardWithState: () => ({ copied: clipboard.copied, copy }),
}));
vi.mock("@/module/game/hook/useCurrentGame", () => ({
    useCurrentGame: () => ({
        data: { game: { prizeAmount: 50, prizeDescription: "un iPhone" } },
    }),
}));

import { GameInviteCard } from "./index";

const LINK = "https://wallet-test.frak.id/r/STORY1";
const SOURCE = { source: "game_page", link: LINK };

describe("GameInviteCard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clipboard.copied = false;
        referral.data = { ownedCode: { code: "STORY1" } };
        canShareNatively.mockReturnValue(true);
    });

    it("renders nothing until the referral status is known", () => {
        referral.data = undefined;
        const { container } = render(<GameInviteCard />);

        expect(container).toBeEmptyDOMElement();
    });

    it("shows the link and what each friend is worth", () => {
        render(<GameInviteCard />);

        expect(
            screen.getByText("wallet-test.frak.id/r/STORY1")
        ).toBeInTheDocument();
        expect(
            screen.getByText("game.page.invite.description:2")
        ).toBeInTheDocument();
    });

    it("shares the game invitation with the link, tracked as the game page", async () => {
        shareNatively.mockResolvedValue(true);
        render(<GameInviteCard />);

        fireEvent.click(
            screen.getByRole("button", { name: /game.page.invite.share/ })
        );

        await waitFor(() =>
            expect(shareNatively).toHaveBeenCalledExactlyOnceWith({
                text: "wallet.referral.share.gameShareText",
                url: LINK,
            })
        );
        await waitFor(() =>
            expect(trackEvent).toHaveBeenLastCalledWith(
                "sharing_link_shared",
                SOURCE
            )
        );
    });

    it("copies the link and confirms it on the button", () => {
        const { rerender } = render(<GameInviteCard />);

        fireEvent.click(
            screen.getByRole("button", {
                name: "wallet.referral.share.copyLink",
            })
        );
        clipboard.copied = true;
        rerender(<GameInviteCard />);

        expect(copy).toHaveBeenCalledWith(LINK);
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "sharing_link_copied",
            SOURCE
        );
        expect(
            screen.getByRole("button", {
                name: "wallet.referral.share.linkCopiedToast",
            })
        ).toBeInTheDocument();
    });

    it("sends a player with no code to create one", () => {
        referral.data = { ownedCode: null };
        render(<GameInviteCard />);

        expect(
            screen.getByText("game.page.invite.noCode:2")
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: "wallet.referral.invite.cta" })
        );

        expect(navigate).toHaveBeenCalledWith({
            to: "/profile/referral/create",
        });
    });
});
