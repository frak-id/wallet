import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { trackEvent, copy, navigate, game } = vi.hoisted(() => ({
    trackEvent: vi.fn(),
    copy: vi.fn(),
    navigate: vi.fn(),
    game: { data: undefined as unknown },
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
    useCopyToClipboardWithState: () => ({ copied: false, copy }),
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
    ReferralPageShell: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

import { ShareReferralCodePage } from "./index";

const SOURCE = { source: "referral_code" };

describe("ShareReferralCodePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        game.data = undefined;
    });
    afterEach(() => {
        Reflect.deleteProperty(navigator, "share");
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

    it("tracks started then shared once the sheet resolves", async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { share });
        render(<ShareReferralCodePage />);

        fireEvent.click(
            screen.getByRole("button", {
                name: /wallet.referral.share.shareCta/,
            })
        );

        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "sharing_link_started",
            SOURCE
        );
        await waitFor(() =>
            expect(trackEvent).toHaveBeenLastCalledWith(
                "sharing_link_shared",
                SOURCE
            )
        );
        expect(trackEvent).toHaveBeenCalledTimes(2);
    });

    it("tracks started but not shared when the sheet is dismissed", async () => {
        const share = vi
            .fn()
            .mockRejectedValue(new DOMException("", "AbortError"));
        Object.assign(navigator, { share });
        render(<ShareReferralCodePage />);

        fireEvent.click(
            screen.getByRole("button", {
                name: /wallet.referral.share.shareCta/,
            })
        );

        await waitFor(() => expect(share).toHaveBeenCalled());
        await Promise.resolve();
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "sharing_link_started",
            SOURCE
        );
        expect(copy).not.toHaveBeenCalled();
    });

    it("copies the share text and tracks a copy without navigator.share", () => {
        render(<ShareReferralCodePage />);

        fireEvent.click(
            screen.getByRole("button", {
                name: /wallet.referral.share.shareCta/,
            })
        );

        expect(copy).toHaveBeenCalledWith("wallet.referral.share.shareText");
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "sharing_link_copied",
            SOURCE
        );
    });
});
