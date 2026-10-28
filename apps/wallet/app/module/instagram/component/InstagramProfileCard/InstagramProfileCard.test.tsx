import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { status, config } = vi.hoisted(() => ({
    status: { data: undefined as unknown },
    config: { enabled: true },
}));

vi.mock("@tanstack/react-router", () => ({
    Link: ({ to, children }: { to: string; children: ReactNode }) => (
        <a href={to}>{children}</a>
    ),
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/module/instagram/config", () => ({ instagramLink: config }));
vi.mock("@/module/instagram/hook/useInstagramLink", () => ({
    useInstagramStatus: () => status,
}));

import { InstagramProfileCard } from "./index";

const certified = (follows: boolean) => ({
    link: { username: "lea", follows, checkedAt: "" },
    declaration: null,
});

describe("InstagramProfileCard", () => {
    beforeEach(() => {
        status.data = { link: null, declaration: null };
        config.enabled = true;
    });

    it("offers to link an account when there is none", () => {
        render(<InstagramProfileCard />);

        const row = screen.getByRole("link", {
            name: /instagram.profile.label/,
        });
        expect(row).toHaveAttribute("href", "/profile/instagram");
        expect(row).toHaveTextContent("instagram.profile.notLinked");
    });

    it("shows a certified follower's handle", () => {
        status.data = certified(true);
        render(<InstagramProfileCard />);

        expect(screen.getByRole("link", { name: /@lea/ })).toHaveTextContent(
            "instagram.linked.badge"
        );
    });

    it("flags a certified account that stopped following", () => {
        status.data = certified(false);
        render(<InstagramProfileCard />);

        expect(
            screen.getByText("instagram.profile.notFollowing")
        ).toBeInTheDocument();
    });

    it("shows a declared handle", () => {
        status.data = {
            link: null,
            declaration: { username: "lea", declaredAt: "" },
        };
        render(<InstagramProfileCard />);

        expect(screen.getByRole("link", { name: /@lea/ })).toHaveTextContent(
            "instagram.declare.badge"
        );
    });

    it("shows no level until the status is loaded", () => {
        status.data = undefined;
        render(<InstagramProfileCard />);

        expect(
            screen.getByRole("link", { name: "instagram.profile.label" })
        ).toBeInTheDocument();
    });

    it("stays hidden while the feature is off", () => {
        config.enabled = false;
        const { container } = render(<InstagramProfileCard />);

        expect(container).toBeEmptyDOMElement();
    });
});
