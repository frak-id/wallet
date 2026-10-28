import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    status,
    code,
    check,
    declare,
    remove,
    copy,
    openExternalUrl,
    ua,
    navigate,
} = vi.hoisted(() => ({
    status: { data: undefined as unknown, isError: false, refetch: vi.fn() },
    code: {
        data: "K7Q2PX" as string | undefined,
        isError: false,
        isFetching: false,
        error: null as unknown,
        refetch: vi.fn(),
    },
    check: {
        mutate: vi.fn(),
        isPending: false,
        isSuccess: false,
        isError: false,
        data: undefined as unknown,
    },
    declare: {
        mutate: vi.fn(),
        isPending: false,
        isError: false,
        error: null as unknown,
    },
    remove: { mutate: vi.fn(), isPending: false, isError: false },
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
    getErrorCode: (error: { value?: { code?: string } } | null) =>
        error?.value?.code,
    openExternalUrl,
    ua,
    useCopyToClipboardWithState: () => ({ copy }),
}));
vi.mock("@/module/common/component/Back", () => ({ Back: () => null }));
vi.mock("@/module/game/hook/useInstagramLink", () => ({
    useInstagramStatus: () => status,
    useInstagramLinkCode: () => code,
    useCheckInstagram: () => check,
    useDeclareInstagram: () => ({ declare, remove }),
}));

import { FRAK_INSTAGRAM_DM_URL } from "@/module/game/config";
import { InstagramLinkPage } from "./index";

const NOTHING = { link: null, declaration: null };
const DECLARED = {
    link: null,
    declaration: { username: "lea", declaredAt: "" },
};
const certified = (follows: boolean) => ({
    link: { username: "lea", follows, checkedAt: "" },
    declaration: null,
});

describe("InstagramLinkPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(status, { data: NOTHING, isError: false });
        Object.assign(code, { data: "K7Q2PX", isError: false, error: null });
        Object.assign(check, {
            isSuccess: false,
            isError: false,
            data: undefined,
        });
        Object.assign(declare, { isError: false, error: null });
        remove.isError = false;
        ua.isMobile = true;
    });

    describe("before any level", () => {
        it("offers to certify first, then to declare", () => {
            render(<InstagramLinkPage />);

            const certify = screen.getByText("game.instagram.certify.title");
            const declareTitle = screen.getByText(
                "game.instagram.declare.title"
            );
            expect(
                certify.compareDocumentPosition(declareTitle) &
                    Node.DOCUMENT_POSITION_FOLLOWING
            ).toBeTruthy();
            expect(
                screen.getByText("game.instagram.certify.perks.unlock", {
                    exact: false,
                })
            ).toBeInTheDocument();
            expect(
                screen.getByText("game.instagram.declare.description")
            ).toBeInTheDocument();
        });

        it("copies the code and opens the DM thread with it as ref", () => {
            render(<InstagramLinkPage />);

            fireEvent.click(
                screen.getByRole("button", { name: "game.instagram.open" })
            );

            expect(copy).toHaveBeenCalledWith("K7Q2PX");
            expect(openExternalUrl).toHaveBeenCalledWith(
                `${FRAK_INSTAGRAM_DM_URL}?ref=K7Q2PX`
            );
            expect(screen.queryByText("game.instagram.mobileOnly")).toBeNull();
        });

        it("asks a desktop user to switch to their phone", () => {
            ua.isMobile = false;
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("game.instagram.mobileOnly")
            ).toBeInTheDocument();
        });

        it("checks again and says when the message has not arrived", () => {
            Object.assign(check, { isSuccess: true, data: NOTHING });
            render(<InstagramLinkPage />);

            fireEvent.click(
                screen.getByRole("button", { name: "game.instagram.sent" })
            );

            expect(check.mutate).toHaveBeenCalled();
            expect(
                screen.getByText("game.instagram.notYet")
            ).toBeInTheDocument();
        });

        it("points to the declaration while certification is off", () => {
            Object.assign(code, {
                data: undefined,
                isError: true,
                error: { value: { code: "INSTAGRAM_UNAVAILABLE" } },
            });
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("game.instagram.certify.unavailable")
            ).toBeInTheDocument();
            expect(
                screen.queryByRole("button", { name: "game.instagram.open" })
            ).toBeNull();
            expect(
                screen.getByRole("button", {
                    name: "game.instagram.declare.submit",
                })
            ).toBeInTheDocument();
        });

        it("retries a code that failed to load", () => {
            Object.assign(code, {
                data: undefined,
                isError: true,
                error: new Error("network"),
            });
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("game.instagram.certify.error")
            ).toBeInTheDocument();
            fireEvent.click(
                screen.getByRole("button", { name: "game.page.retry" })
            );
            expect(code.refetch).toHaveBeenCalled();
        });

        it("declares the typed handle", () => {
            render(<InstagramLinkPage />);

            fireEvent.change(
                screen.getByLabelText("game.instagram.declare.label"),
                { target: { value: "@Lea" } }
            );
            fireEvent.click(
                screen.getByRole("button", {
                    name: "game.instagram.declare.submit",
                })
            );

            expect(declare.mutate).toHaveBeenCalledWith(
                "@Lea",
                expect.anything()
            );
        });

        it("explains a handle the backend refused", () => {
            Object.assign(declare, {
                isError: true,
                error: { value: { code: "INVALID_INSTAGRAM_HANDLE" } },
            });
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("game.instagram.declare.invalid")
            ).toBeInTheDocument();
        });
    });

    describe("declared", () => {
        it("shows the handle and pushes to certify it", () => {
            status.data = DECLARED;
            render(<InstagramLinkPage />);

            expect(screen.getByText("@lea")).toBeInTheDocument();
            expect(
                screen.getByText("game.instagram.declare.badge")
            ).toBeInTheDocument();
            expect(
                screen.getByText("game.instagram.declare.upsell")
            ).toBeInTheDocument();
            expect(
                screen.getByText("game.instagram.certify.title")
            ).toBeInTheDocument();
            expect(
                screen.queryByRole("button", {
                    name: "game.instagram.declare.submit",
                })
            ).toBeNull();
        });

        it("removes the declaration", () => {
            status.data = DECLARED;
            render(<InstagramLinkPage />);

            fireEvent.click(
                screen.getByRole("button", {
                    name: "game.instagram.declare.remove",
                })
            );

            expect(remove.mutate).toHaveBeenCalled();
        });

        it("says when the declaration could not be removed", () => {
            status.data = DECLARED;
            remove.isError = true;
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("game.instagram.declare.removeError")
            ).toBeInTheDocument();
        });

        it("edits the handle in place, and can cancel", () => {
            status.data = DECLARED;
            render(<InstagramLinkPage />);

            fireEvent.click(
                screen.getByRole("button", {
                    name: "game.instagram.declare.change",
                })
            );

            expect(
                screen.getByText("game.instagram.declare.editTitle")
            ).toBeInTheDocument();
            expect(
                screen.getByLabelText("game.instagram.declare.label")
            ).toHaveValue("lea");
            expect(
                screen.getByRole("button", {
                    name: "game.instagram.declare.save",
                })
            ).toBeInTheDocument();

            fireEvent.click(
                screen.getByRole("button", {
                    name: "game.instagram.declare.cancel",
                })
            );
            expect(screen.getByText("@lea")).toBeInTheDocument();
            expect(
                screen.queryByLabelText("game.instagram.declare.label")
            ).toBeNull();
        });
    });

    describe("certified", () => {
        it("confirms a follower and goes back to the game", () => {
            status.data = certified(true);
            render(<InstagramLinkPage />);

            expect(screen.getByText("@lea")).toBeInTheDocument();
            expect(
                screen.queryByText("game.instagram.declare.title")
            ).toBeNull();
            fireEvent.click(
                screen.getByRole("button", {
                    name: "game.instagram.linked.back",
                })
            );
            expect(navigate).toHaveBeenCalledWith({ to: "/game" });
        });

        it("asks a non-follower to follow, then check again", () => {
            status.data = certified(false);
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
            status.data = certified(false);
            Object.assign(check, { isSuccess: true, data: certified(false) });
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("game.instagram.linked.stillNotFollowing")
            ).toBeInTheDocument();
        });

        it("says when Instagram cannot be checked", () => {
            status.data = certified(false);
            Object.assign(check, { isError: true });
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("game.instagram.certify.checkError")
            ).toBeInTheDocument();
        });
    });

    it("offers a retry when the status fails to load", () => {
        Object.assign(status, { data: undefined, isError: true });
        render(<InstagramLinkPage />);

        expect(screen.getByText("game.page.error")).toBeInTheDocument();
    });
});
