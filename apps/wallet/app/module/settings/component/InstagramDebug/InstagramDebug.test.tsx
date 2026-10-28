import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { env, game, status, save, revoke } = vi.hoisted(() => ({
    env: { prod: false },
    game: { enabled: true },
    status: { data: undefined as unknown, isError: false },
    save: { mutate: vi.fn(), isPending: false, error: null as unknown },
    revoke: { mutate: vi.fn(), isPending: false, error: null as unknown },
}));

vi.mock("@frak-labs/app-essentials", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@frak-labs/app-essentials")>()),
    get isRunningInProd() {
        return env.prod;
    },
}));
vi.mock("@/module/game/config", () => ({ frakGame: game }));
vi.mock("@/module/game/hook/useInstagramLink", () => ({
    useInstagramStatus: () => status,
}));
vi.mock("@/module/game/hook/useMockInstagramLink", () => ({
    useMockInstagramLink: () => ({ link: save, revoke }),
}));

import { InstagramDebug } from "./index";

const FOLLOWER = {
    username: "lea",
    follows: true,
    checkedAt: new Date("2026-10-26T10:00:00Z"),
};
const certified = (link: typeof FOLLOWER) => ({ link, declaration: null });

describe("InstagramDebug", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        env.prod = false;
        game.enabled = true;
        Object.assign(status, {
            data: { link: null, declaration: null },
            isError: false,
        });
        Object.assign(save, { isPending: false, error: null });
        Object.assign(revoke, { isPending: false, error: null });
    });

    it("renders nothing while the game is off", () => {
        game.enabled = false;
        const { container } = render(<InstagramDebug />);

        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing in production even once the game is on", () => {
        env.prod = true;
        const { container } = render(<InstagramDebug />);

        expect(container).toBeEmptyDOMElement();
    });

    it("says when the status failed to load instead of waiting forever", () => {
        Object.assign(status, { data: undefined, isError: true });
        render(<InstagramDebug />);

        expect(
            screen.getByText("Could not load the Instagram status.")
        ).toBeVisible();
    });

    it("tells a declared handle apart from a certified one", () => {
        status.data = {
            link: null,
            declaration: { username: "lea", declaredAt: "" },
        };
        render(<InstagramDebug />);

        expect(
            screen.getByText("Declared @lea (eligible, checked only if drawn).")
        ).toBeVisible();
    });

    it("links the typed handle as a follower by default", () => {
        render(<InstagramDebug />);

        expect(
            screen.getByText("No Instagram account declared or certified.")
        ).toBeVisible();
        fireEvent.change(screen.getByLabelText("Handle"), {
            target: { value: "@Lea" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Link" }));

        expect(save.mutate).toHaveBeenCalledWith({
            username: "@Lea",
            follows: true,
        });
    });

    it("links a non-follower once the switch is turned off", () => {
        render(<InstagramDebug />);

        fireEvent.change(screen.getByLabelText("Handle"), {
            target: { value: "lea" },
        });
        fireEvent.click(
            screen.getByRole("switch", { name: "Follows @frak_fr" })
        );
        fireEvent.click(screen.getByRole("button", { name: "Link" }));

        expect(save.mutate).toHaveBeenCalledWith({
            username: "lea",
            follows: false,
        });
    });

    it("cannot link without a handle nor revoke without a link", () => {
        render(<InstagramDebug />);

        expect(screen.getByRole("button", { name: "Link" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Revoke" })).toBeDisabled();
    });

    it("shows the linked account and revokes it", () => {
        status.data = certified(FOLLOWER);
        render(<InstagramDebug />);

        expect(
            screen.getByText(
                "Certified @lea, follows @frak_fr (eligible: yes)."
            )
        ).toBeVisible();
        expect(screen.getByLabelText("Handle")).toHaveValue("lea");
        expect(screen.getByRole("button", { name: "Update" })).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

        expect(revoke.mutate).toHaveBeenCalled();
    });

    it("says a linked non-follower is not eligible", () => {
        status.data = certified({ ...FOLLOWER, follows: false });
        render(<InstagramDebug />);

        expect(
            screen.getByText(
                "Certified @lea, does not follow @frak_fr (eligible: no)."
            )
        ).toBeVisible();
    });

    it("explains a handle the backend refused", () => {
        save.error = {
            status: 400,
            value: { code: "INVALID_INSTAGRAM_HANDLE" },
        };
        render(<InstagramDebug />);

        expect(
            screen.getByText("That is not a valid Instagram handle.")
        ).toBeVisible();
    });

    it("falls back to a generic message for an unknown failure", () => {
        revoke.error = new Error("network");
        render(<InstagramDebug />);

        expect(screen.getByText("The mock request failed.")).toBeVisible();
    });
});
