import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
    status,
    code,
    check,
    declare,
    remove,
    clipboard,
    openExternalUrl,
    ua,
    navigate,
    router,
    sent,
    trackEvent,
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
    sent: {
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
    clipboard: { copy: vi.fn(), copied: false },
    openExternalUrl: vi.fn(),
    ua: { isMobile: true },
    navigate: vi.fn(),
    router: { canGoBack: true, history: { back: vi.fn() } },
    trackEvent: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => navigate,
    useRouter: () => router,
    useCanGoBack: () => router.canGoBack,
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@frak-labs/wallet-shared", () => ({
    getErrorCode: (error: { value?: { code?: string } } | null) =>
        error?.value?.code,
    openExternalUrl,
    trackEvent,
    ua,
    useCopyToClipboardWithState: () => clipboard,
}));
vi.mock("@/module/common/component/Back", () => ({ Back: () => null }));
vi.mock("@/module/instagram/hook/useInstagramLink", () => ({
    useInstagramStatus: () => status,
    useInstagramLinkCode: () => code,
    useAwaitInstagramDm: () => sent,
    useCheckInstagram: () => check,
    useDeclareInstagram: () => ({ declare, remove }),
    useRefreshInstagramFollow: () => undefined,
}));

import {
    FRAK_INSTAGRAM_DM_URL,
    FRAK_INSTAGRAM_URL,
} from "@/module/instagram/config";
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

function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state,
    });
    document.dispatchEvent(new Event("visibilitychange"));
}

const button = (name: string) => screen.getByRole("button", { name });

describe("InstagramLinkPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(status, { data: NOTHING, isError: false });
        Object.assign(code, { data: "K7Q2PX", isError: false, error: null });
        for (const mutation of [check, sent]) {
            Object.assign(mutation, {
                isPending: false,
                isSuccess: false,
                isError: false,
                data: undefined,
            });
        }
        router.canGoBack = true;
        Object.assign(declare, { isError: false, error: null });
        remove.isError = false;
        clipboard.copied = false;
        ua.isMobile = true;
    });

    afterEach(() => setVisibility("visible"));

    describe("before any level", () => {
        it("leads with connecting, and keeps the handle behind a link", () => {
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("instagram.certify.title")
            ).toBeInTheDocument();
            expect(screen.getByText("K7Q2PX")).toBeInTheDocument();
            expect(
                screen.queryByLabelText("instagram.declare.label")
            ).toBeNull();
            expect(button("instagram.declare.open")).toBeInTheDocument();
        });

        it("copies the code from the chip", () => {
            render(<InstagramLinkPage />);

            fireEvent.click(button("instagram.certify.copy"));

            expect(clipboard.copy).toHaveBeenCalledWith("K7Q2PX");
            expect(openExternalUrl).not.toHaveBeenCalled();
        });

        it("says the code is copied", () => {
            clipboard.copied = true;
            render(<InstagramLinkPage />);

            expect(button("instagram.certify.copied")).toBeInTheDocument();
        });

        it("copies the code and opens the DM thread with it as ref", () => {
            render(<InstagramLinkPage />);

            fireEvent.click(button("instagram.certify.open"));

            expect(clipboard.copy).toHaveBeenCalledWith("K7Q2PX");
            expect(openExternalUrl).toHaveBeenCalledWith(
                `${FRAK_INSTAGRAM_DM_URL}?ref=K7Q2PX`
            );
            expect(screen.queryByText("instagram.mobileOnly")).toBeNull();
        });

        it("looks for the message once the player is back from Instagram", () => {
            render(<InstagramLinkPage />);

            fireEvent.click(button("instagram.certify.open"));
            setVisibility("hidden");
            expect(sent.mutate).not.toHaveBeenCalled();

            setVisibility("visible");
            expect(sent.mutate).toHaveBeenCalledTimes(1);
        });

        it("does not look for a message without Instagram being opened", () => {
            render(<InstagramLinkPage />);

            setVisibility("hidden");
            setVisibility("visible");

            expect(sent.mutate).not.toHaveBeenCalled();
        });

        it("shows the wait while the message is looked for", () => {
            sent.isPending = true;
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("instagram.certify.waiting")
            ).toBeInTheDocument();
            expect(
                screen.queryByRole("button", {
                    name: "instagram.certify.checkAgain",
                })
            ).toBeNull();
        });

        it("says when the message never arrived, and looks again", () => {
            Object.assign(sent, { isSuccess: true, data: NOTHING });
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("instagram.certify.notYet")
            ).toBeInTheDocument();
            fireEvent.click(button("instagram.certify.checkAgain"));
            expect(sent.mutate).toHaveBeenCalled();
        });

        it("says when Instagram could not be checked", () => {
            sent.isError = true;
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("instagram.certify.checkError")
            ).toBeInTheDocument();
            expect(button("instagram.certify.checkAgain")).toBeInTheDocument();
        });

        it("asks a desktop user to switch to their phone", () => {
            ua.isMobile = false;
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("instagram.mobileOnly")
            ).toBeInTheDocument();
        });

        it("opens the handle form while connecting is off", () => {
            Object.assign(code, {
                data: undefined,
                isError: true,
                error: { value: { code: "INSTAGRAM_UNAVAILABLE" } },
            });
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("instagram.certify.unavailable")
            ).toBeInTheDocument();
            expect(
                screen.queryByRole("button", {
                    name: "instagram.certify.open",
                })
            ).toBeNull();
            expect(button("instagram.declare.submit")).toBeInTheDocument();
            expect(
                screen.queryByRole("button", {
                    name: "instagram.declare.cancel",
                })
            ).toBeNull();
        });

        it("retries a code that failed to load", () => {
            Object.assign(code, {
                data: undefined,
                isError: true,
                error: new Error("network"),
            });
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("instagram.certify.error")
            ).toBeInTheDocument();
            fireEvent.click(button("instagram.retry"));
            expect(code.refetch).toHaveBeenCalled();
        });

        it("declares the typed handle from the link", () => {
            render(<InstagramLinkPage />);

            fireEvent.click(button("instagram.declare.open"));
            fireEvent.change(screen.getByLabelText("instagram.declare.label"), {
                target: { value: "@Lea" },
            });
            fireEvent.click(button("instagram.declare.submit"));

            expect(declare.mutate).toHaveBeenCalledWith(
                "@Lea",
                expect.anything()
            );
        });

        it("folds the handle form back", () => {
            render(<InstagramLinkPage />);

            fireEvent.click(button("instagram.declare.open"));
            fireEvent.click(button("instagram.declare.cancel"));

            expect(
                screen.queryByLabelText("instagram.declare.label")
            ).toBeNull();
            expect(button("instagram.declare.open")).toBeInTheDocument();
        });

        it("explains a handle the backend refused", () => {
            Object.assign(declare, {
                isError: true,
                error: { value: { code: "INVALID_INSTAGRAM_HANDLE" } },
            });
            render(<InstagramLinkPage />);

            fireEvent.click(button("instagram.declare.open"));

            expect(
                screen.getByText("instagram.declare.invalid")
            ).toBeInTheDocument();
        });
    });

    describe("declared", () => {
        it("shows the handle to confirm above the way to connect it", () => {
            status.data = DECLARED;
            render(<InstagramLinkPage />);

            const handle = screen.getByText("@lea");
            const connect = screen.getByText("instagram.certify.title");
            expect(
                handle.compareDocumentPosition(connect) &
                    Node.DOCUMENT_POSITION_FOLLOWING
            ).toBeTruthy();
            expect(
                screen.getByText("instagram.declare.badge")
            ).toBeInTheDocument();
            expect(
                screen.queryByRole("button", {
                    name: "instagram.declare.open",
                })
            ).toBeNull();
        });

        it("removes the declaration", () => {
            status.data = DECLARED;
            render(<InstagramLinkPage />);

            fireEvent.click(button("instagram.declare.remove"));

            expect(remove.mutate).toHaveBeenCalled();
        });

        it("says when the declaration could not be removed", () => {
            status.data = DECLARED;
            remove.isError = true;
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("instagram.declare.removeError")
            ).toBeInTheDocument();
        });

        it("edits the handle in place, and can cancel", () => {
            status.data = DECLARED;
            render(<InstagramLinkPage />);

            fireEvent.click(button("instagram.declare.change"));

            expect(
                screen.getByText("instagram.declare.editTitle")
            ).toBeInTheDocument();
            expect(
                screen.getByLabelText("instagram.declare.label")
            ).toHaveValue("lea");

            fireEvent.click(button("instagram.declare.cancel"));
            expect(screen.getByText("@lea")).toBeInTheDocument();
            expect(
                screen.queryByLabelText("instagram.declare.label")
            ).toBeNull();
        });
    });

    describe("certified", () => {
        it("confirms a follower and returns to the opener", () => {
            status.data = certified(true);
            render(<InstagramLinkPage />);

            expect(screen.getByText("@lea")).toBeInTheDocument();
            expect(
                screen.getByText("instagram.linked.badge")
            ).toBeInTheDocument();
            fireEvent.click(button("instagram.linked.done"));
            expect(router.history.back).toHaveBeenCalled();
            expect(navigate).not.toHaveBeenCalled();
        });

        it("lands on the profile when opened from a deep link", () => {
            status.data = certified(true);
            router.canGoBack = false;
            render(<InstagramLinkPage />);

            fireEvent.click(button("instagram.linked.done"));
            expect(navigate).toHaveBeenCalledWith({ to: "/profile" });
        });

        it("sends a non-follower to @frak_fr, then checks again", () => {
            status.data = certified(false);
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("instagram.linked.notFollowing")
            ).toBeInTheDocument();
            fireEvent.click(button("instagram.linked.follow"));
            expect(openExternalUrl).toHaveBeenCalledWith(FRAK_INSTAGRAM_URL);

            fireEvent.click(button("instagram.linked.checkAgain"));
            expect(check.mutate).toHaveBeenCalled();
        });

        it("says when a re-check still finds no follow", () => {
            status.data = certified(false);
            Object.assign(check, { isSuccess: true, data: certified(false) });
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("instagram.linked.stillNotFollowing")
            ).toBeInTheDocument();
        });

        it("says when Instagram cannot be checked", () => {
            status.data = certified(false);
            Object.assign(check, { isError: true });
            render(<InstagramLinkPage />);

            expect(
                screen.getByText("instagram.certify.checkError")
            ).toBeInTheDocument();
        });
    });

    describe("analytics", () => {
        const settle = (
            callback: "onSuccess" | "onError",
            value?: unknown,
            call = 0
        ) => sent.mutate.mock.calls[call][1][callback](value);

        it("tracks the page once per mount, once the status is known", () => {
            status.data = undefined;
            const { rerender } = render(<InstagramLinkPage />);
            expect(trackEvent).not.toHaveBeenCalled();

            status.data = NOTHING;
            rerender(<InstagramLinkPage />);
            rerender(<InstagramLinkPage />);

            expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
                "instagram_page_viewed",
                { level: "none", follows: null }
            );
        });

        it.each([
            ["declared", DECLARED, { level: "declared", follows: null }],
            [
                "certified",
                certified(true),
                { level: "certified", follows: true },
            ],
            [
                "not following",
                certified(false),
                { level: "certified", follows: false },
            ],
        ])("reports the %s level", (_name, data, payload) => {
            status.data = data;
            render(<InstagramLinkPage />);

            expect(trackEvent).toHaveBeenCalledWith(
                "instagram_page_viewed",
                payload
            );
        });

        it("tracks the DM being opened", () => {
            render(<InstagramLinkPage />);

            fireEvent.click(button("instagram.certify.open"));

            expect(trackEvent).toHaveBeenCalledWith("instagram_dm_opened");
        });

        it("tracks the declare form being opened from its link", () => {
            render(<InstagramLinkPage />);
            trackEvent.mockClear();

            fireEvent.click(button("instagram.declare.open"));

            expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
                "instagram_declare_opened"
            );
        });

        it("does not track the declare form when connecting is off", () => {
            Object.assign(code, {
                data: undefined,
                isError: true,
                error: { value: { code: "INSTAGRAM_UNAVAILABLE" } },
            });
            render(<InstagramLinkPage />);

            expect(trackEvent).not.toHaveBeenCalledWith(
                "instagram_declare_opened"
            );
        });

        it("tracks a linked check on return, not as a retry", () => {
            render(<InstagramLinkPage />);
            fireEvent.click(button("instagram.certify.open"));
            setVisibility("hidden");
            setVisibility("visible");
            trackEvent.mockClear();

            settle("onSuccess", certified(false));

            expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
                "instagram_dm_checked",
                { outcome: "linked", retry: false }
            );
        });

        it("tracks an unreceived and a failed check", () => {
            render(<InstagramLinkPage />);
            fireEvent.click(button("instagram.certify.open"));
            setVisibility("hidden");
            setVisibility("visible");
            trackEvent.mockClear();

            settle("onSuccess", NOTHING);
            settle("onError");

            expect(trackEvent.mock.calls).toEqual([
                [
                    "instagram_dm_checked",
                    { outcome: "not_received", retry: false },
                ],
                ["instagram_dm_checked", { outcome: "error", retry: false }],
            ]);
        });

        it("flags the check again button as a retry", () => {
            Object.assign(sent, { isSuccess: true, data: NOTHING });
            render(<InstagramLinkPage />);

            fireEvent.click(button("instagram.certify.checkAgain"));
            trackEvent.mockClear();
            settle("onSuccess", NOTHING);

            expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
                "instagram_dm_checked",
                { outcome: "not_received", retry: true }
            );
        });

        it("does not track a check on re-render", () => {
            Object.assign(sent, { isSuccess: true, data: NOTHING });
            const { rerender } = render(<InstagramLinkPage />);
            rerender(<InstagramLinkPage />);

            expect(trackEvent).not.toHaveBeenCalledWith(
                "instagram_dm_checked",
                expect.anything()
            );
        });
    });

    it("offers a retry when the status fails to load", () => {
        Object.assign(status, { data: undefined, isError: true });
        render(<InstagramLinkPage />);

        expect(screen.getByText("instagram.error")).toBeInTheDocument();
    });
});
