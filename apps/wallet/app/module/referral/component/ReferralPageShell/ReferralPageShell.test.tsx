import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { router, navigate, nav } = vi.hoisted(() => ({
    router: { history: { back: vi.fn() } },
    navigate: vi.fn(),
    nav: { canGoBack: true },
}));

vi.mock("@tanstack/react-router", () => ({
    useRouter: () => router,
    useNavigate: () => navigate,
    useCanGoBack: () => nav.canGoBack,
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../TermsDisclosure", () => ({ TermsDisclosure: () => null }));

import { ReferralPageShell } from "./index";

describe("ReferralPageShell", () => {
    beforeEach(() => vi.clearAllMocks());

    it("goes back to the screen that opened it", () => {
        nav.canGoBack = true;
        render(<ReferralPageShell title="t">body</ReferralPageShell>);

        fireEvent.click(screen.getByRole("button", { name: "common.back" }));

        expect(router.history.back).toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    it("falls back to backHref when there is no history", () => {
        nav.canGoBack = false;
        render(
            <ReferralPageShell title="t" backHref="/profile/referral/create">
                body
            </ReferralPageShell>
        );

        fireEvent.click(screen.getByRole("button", { name: "common.back" }));

        expect(navigate).toHaveBeenCalledWith({
            to: "/profile/referral/create",
        });
        expect(router.history.back).not.toHaveBeenCalled();
    });
});
