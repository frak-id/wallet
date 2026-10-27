import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { link, check, copy, openExternalUrl, ua, navigate } = vi.hoisted(() => ({
    link: { data: undefined as unknown, isError: false, refetch: vi.fn() },
    check: {
        mutate: vi.fn(),
        isPending: false,
        isSuccess: false,
        data: undefined as unknown,
    },
    copy: vi.fn(),
    openExternalUrl: vi.fn(),
    ua: { isMobile: true },
    navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: ({ i18nKey }: { i18nKey: string }) => <>{i18nKey}</>,
}));
vi.mock("@frak-labs/wallet-shared", () => ({
    ExternalLink: () => null,
    openExternalUrl,
    ua,
    useCopyToClipboardWithState: () => ({ copy }),
}));
vi.mock("@/module/common/component/Back", () => ({ Back: () => null }));
vi.mock("@/module/game/hook/useInstagramLink", () => ({
    useInstagramLink: () => link,
    useInstagramLinkCode: () => ({ data: { code: "K7Q2PX" } }),
    useCheckInstagram: () => check,
}));

import { InstagramLinkPage } from "./index";

describe("InstagramLinkPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(check, { isSuccess: false, data: undefined });
        ua.isMobile = true;
    });

    it("copies the code and opens the @frak_fr chat with it as ref", () => {
        link.data = null;
        render(<InstagramLinkPage />);

        fireEvent.click(
            screen.getByRole("button", { name: "game.instagram.open" })
        );

        expect(copy).toHaveBeenCalledWith("K7Q2PX");
        expect(openExternalUrl).toHaveBeenCalledWith(
            "https://ig.me/m/frak_fr?ref=K7Q2PX"
        );
        expect(screen.queryByText("game.instagram.mobileOnly")).toBeNull();
    });

    it("asks a desktop user to switch to their phone", () => {
        link.data = null;
        ua.isMobile = false;
        render(<InstagramLinkPage />);

        expect(
            screen.getByText("game.instagram.mobileOnly")
        ).toBeInTheDocument();
    });

    it("checks again and says when the message has not arrived", () => {
        link.data = null;
        Object.assign(check, { isSuccess: true, data: null });
        render(<InstagramLinkPage />);

        fireEvent.click(
            screen.getByRole("button", { name: "game.instagram.sent" })
        );

        expect(check.mutate).toHaveBeenCalled();
        expect(screen.getByText("game.instagram.notYet")).toBeInTheDocument();
    });

    it("confirms a linked follower and goes back to the game", () => {
        link.data = { username: "lea", follows: true, checkedAt: "" };
        render(<InstagramLinkPage />);

        expect(screen.getByText("@lea")).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: "game.instagram.linked.back" })
        );
        expect(navigate).toHaveBeenCalledWith({ to: "/game" });
    });

    it("asks a linked non-follower to follow, then check again", () => {
        link.data = { username: "lea", follows: false, checkedAt: "" };
        render(<InstagramLinkPage />);

        expect(
            screen.getByText("game.instagram.linked.notFollowing")
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", {
                name: "game.instagram.linked.checkAgain",
            })
        );
        expect(check.mutate).toHaveBeenCalled();
    });

    it("says when a re-check still finds no follow", () => {
        link.data = { username: "lea", follows: false, checkedAt: "" };
        Object.assign(check, { isSuccess: true, data: link.data });
        render(<InstagramLinkPage />);

        expect(
            screen.getByText("game.instagram.linked.stillNotFollowing")
        ).toBeInTheDocument();
    });

    it("offers a retry when the link fails to load", () => {
        link.data = undefined;
        link.isError = true;
        render(<InstagramLinkPage />);
        link.isError = false;

        expect(screen.getByText("game.page.error")).toBeInTheDocument();
    });
});
