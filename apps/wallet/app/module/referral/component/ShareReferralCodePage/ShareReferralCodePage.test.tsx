import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    trackEvent,
    recordError,
    copy,
    navigate,
    game,
    canShareNatively,
    shareNatively,
    clipboard,
} = vi.hoisted(() => ({
    trackEvent: vi.fn(),
    recordError: vi.fn(),
    copy: vi.fn(),
    navigate: vi.fn(),
    game: { data: undefined as unknown },
    canShareNatively: vi.fn(),
    shareNatively: vi.fn(),
    clipboard: { copied: false },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "fr-FR" },
    }),
}));
vi.mock("@frak-labs/wallet-shared", () => ({
    trackEvent,
    recordError,
    canShareNatively,
    shareNatively,
    useCopyToClipboardWithState: () => ({ copied: clipboard.copied, copy }),
    useReferralStatus: () => ({
        data: { ownedCode: { code: "STORY1", createdAt: "2026-10-20" } },
    }),
}));
vi.mock("@/module/game/hook/useCurrentGame", () => ({
    useCurrentGame: () => game,
}));
vi.mock("@/module/stores/modalStore", () => ({
    modalStore: (select: (s: { openModal: () => void }) => unknown) =>
        select({ openModal: vi.fn() }),
}));
vi.mock("../ReferralPageShell", () => ({
    ReferralPageShell: ({
        description,
        children,
    }: {
        description: string;
        children: React.ReactNode;
    }) => (
        <div>
            <p>{description}</p>
            {children}
        </div>
    ),
}));

import { ShareReferralCodePage } from "./index";

const SOURCE = { source: "referral_code" };
const LINK = "https://wallet-test.frak.id/r/STORY1";
const LINK_SOURCE = { ...SOURCE, link: LINK };

describe("ShareReferralCodePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        game.data = undefined;
        clipboard.copied = false;
        canShareNatively.mockReturnValue(true);
    });

    it("explains how a friend counts in the game to a player in it", () => {
        game.data = { game: {}, me: { participating: true } };
        render(<ShareReferralCodePage />);

        expect(
            screen.getByText("wallet.referral.share.gameHint")
        ).toBeInTheDocument();
    });

    it.each([
        ["no game is open", undefined],
        [
            "the player is not in the game",
            { game: {}, me: { participating: false } },
        ],
    ])("leaves the game hint out when %s", (_, data) => {
        game.data = data;
        render(<ShareReferralCodePage />);

        expect(screen.queryByText("wallet.referral.share.gameHint")).toBeNull();
    });

    it("tracks a copy of the code", () => {
        render(<ShareReferralCodePage />);

        fireEvent.click(
            screen.getByRole("button", {
                name: "wallet.referral.share.copyCode",
            })
        );

        expect(copy).toHaveBeenCalledWith("STORY1");
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "sharing_link_copied",
            SOURCE
        );
    });

    it("shows the code's link without its scheme", () => {
        render(<ShareReferralCodePage />);

        expect(
            screen.getByText("wallet-test.frak.id/r/STORY1")
        ).toBeInTheDocument();
    });

    it("copies the full link and tracks it apart from a code copy", () => {
        render(<ShareReferralCodePage />);

        fireEvent.click(
            screen.getByRole("button", {
                name: "wallet.referral.share.copyLink",
            })
        );

        expect(copy).toHaveBeenCalledWith(LINK);
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "sharing_link_copied",
            LINK_SOURCE
        );
    });

    it.each([
        ["wallet.referral.share.copyCode", "wallet.referral.share.copiedToast"],
        [
            "wallet.referral.share.copyLink",
            "wallet.referral.share.linkCopiedToast",
        ],
    ])("confirms %s with %s", (button, toast) => {
        const { rerender } = render(<ShareReferralCodePage />);

        fireEvent.click(screen.getByRole("button", { name: button }));
        clipboard.copied = true;
        rerender(<ShareReferralCodePage />);

        expect(screen.getByText(toast)).toBeInTheDocument();
    });

    it("shares the text and the link through the native share primitive", async () => {
        shareNatively.mockResolvedValue(true);
        render(<ShareReferralCodePage />);

        fireEvent.click(
            screen.getByRole("button", {
                name: /wallet.referral.share.shareCta/,
            })
        );

        await waitFor(() =>
            expect(shareNatively).toHaveBeenCalledExactlyOnceWith({
                text: "wallet.referral.share.shareText",
                url: LINK,
            })
        );
    });

    it("tracks started then shared once the sheet resolves", async () => {
        shareNatively.mockResolvedValue(true);
        render(<ShareReferralCodePage />);

        fireEvent.click(
            screen.getByRole("button", {
                name: /wallet.referral.share.shareCta/,
            })
        );

        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "sharing_link_started",
            LINK_SOURCE
        );
        await waitFor(() =>
            expect(trackEvent).toHaveBeenLastCalledWith(
                "sharing_link_shared",
                LINK_SOURCE
            )
        );
        expect(trackEvent).toHaveBeenCalledTimes(2);
    });

    it("tracks started but not shared when the sheet is dismissed", async () => {
        shareNatively.mockResolvedValue(false);
        render(<ShareReferralCodePage />);

        fireEvent.click(
            screen.getByRole("button", {
                name: /wallet.referral.share.shareCta/,
            })
        );

        await waitFor(() => expect(shareNatively).toHaveBeenCalled());
        await Promise.resolve();
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "sharing_link_started",
            LINK_SOURCE
        );
        expect(copy).not.toHaveBeenCalled();
    });

    it("reports a share sheet the native plugin failed to open", async () => {
        const failure = "A share sheet is already open";
        shareNatively.mockRejectedValue(failure);
        render(<ShareReferralCodePage />);

        fireEvent.click(
            screen.getByRole("button", {
                name: /wallet.referral.share.shareCta/,
            })
        );

        await waitFor(() =>
            expect(recordError).toHaveBeenCalledWith(failure, {
                source: "sharing",
                context: { sharing_source: "referral_code" },
            })
        );
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "sharing_link_started",
            LINK_SOURCE
        );
    });

    it("copies the share text and the link where nothing can share", () => {
        canShareNatively.mockReturnValue(false);
        render(<ShareReferralCodePage />);

        fireEvent.click(
            screen.getByRole("button", {
                name: /wallet.referral.share.shareCta/,
            })
        );

        expect(copy).toHaveBeenCalledWith(
            `wallet.referral.share.shareText\n${LINK}`
        );
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "sharing_link_copied",
            LINK_SOURCE
        );
    });
});
