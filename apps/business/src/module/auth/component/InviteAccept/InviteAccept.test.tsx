import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { AuthError } from "@/module/auth/utils/authError";
import { useAuthStore } from "@/stores/authStore";
import { describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) =>
            options && Object.keys(options).length > 0
                ? `${key}:${JSON.stringify(options)}`
                : key,
    }),
    Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
}));

const mockPreview = vi.fn();
const mockClaim = vi.fn();
vi.mock("@/module/auth/hooks/useInvite", () => ({
    useInvitePreview: (token: string | undefined) => mockPreview(token),
    useInviteClaim: () => mockClaim(),
}));

import { InviteAccept } from "./index";

const VALID_PREVIEW = {
    email: "invitee@test.com",
    merchantName: "Acme",
    inviterName: "Jane",
    alreadyClaimed: false,
};

function previewState(
    overrides: Partial<{
        data: typeof VALID_PREVIEW;
        isPending: boolean;
        isError: boolean;
        error: unknown;
    }> = {}
) {
    return {
        data: undefined,
        isPending: false,
        isError: false,
        error: null,
        ...overrides,
    };
}

describe("InviteAccept", () => {
    afterEach(() => {
        vi.clearAllMocks();
        useAuthStore.getState().clearAuth();
    });

    test("shows the invalid state without a token, and never previews", () => {
        mockPreview.mockReturnValue(previewState());
        mockClaim.mockReturnValue({ mutate: vi.fn(), isPending: false });

        render(<InviteAccept token={undefined} />);

        expect(
            screen.getByText("auth.invite.invalidToken")
        ).toBeInTheDocument();
        expect(screen.getByText("auth.invite.askToResend")).toBeInTheDocument();
        expect(mockPreview).toHaveBeenCalledWith(undefined);
    });

    test("shows a loading state while previewing", () => {
        mockPreview.mockReturnValue(previewState({ isPending: true }));
        mockClaim.mockReturnValue({ mutate: vi.fn(), isPending: false });

        render(<InviteAccept token="tok" />);

        expect(
            screen.queryByText("auth.invite.invalidToken")
        ).not.toBeInTheDocument();
        expect(screen.queryByText("auth.invite.title")).not.toBeInTheDocument();
    });

    test("maps the backend INVALID_INVITATION code to the translated invalid state", () => {
        mockPreview.mockReturnValue(
            previewState({
                isError: true,
                error: new AuthError("Backend english", "INVALID_INVITATION"),
            })
        );
        mockClaim.mockReturnValue({ mutate: vi.fn(), isPending: false });

        render(<InviteAccept token="tok" />);

        expect(
            screen.getByText("auth.invite.invalidToken")
        ).toBeInTheDocument();
        expect(screen.queryByText("Backend english")).not.toBeInTheDocument();
    });

    test("shows the already-claimed state with a login CTA", () => {
        mockPreview.mockReturnValue(
            previewState({
                data: { ...VALID_PREVIEW, alreadyClaimed: true },
            })
        );
        mockClaim.mockReturnValue({ mutate: vi.fn(), isPending: false });

        render(<InviteAccept token="tok" />);

        expect(
            screen.getByText(/auth\.invite\.alreadyClaimed/)
        ).toBeInTheDocument();
        fireEvent.click(screen.getByText("auth.invite.goToLogin"));
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
    });

    test("prompts an already-authenticated user before showing the claim form", () => {
        useAuthStore.getState().setAuth({
            token: "session",
            authMethod: "password",
            expiresAt: Date.now() + 60_000,
            pending2fa: false,
        });
        mockPreview.mockReturnValue(
            previewState({
                // Even an already-claimed invite defers to the session prompt.
                data: { ...VALID_PREVIEW, alreadyClaimed: true },
            })
        );
        mockClaim.mockReturnValue({ mutate: vi.fn(), isPending: false });

        render(<InviteAccept token="tok" />);

        expect(
            screen.getByText(/auth\.invite\.alreadyAuthenticated/)
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/auth\.invite\.alreadyClaimed:/)
        ).not.toBeInTheDocument();

        // Signing out reveals the flow for the invited account
        fireEvent.click(screen.getByText("auth.invite.signOutFirst"));
        expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    });

    test("claims with just a password and navigates to the merchant dashboard", async () => {
        const mutate = vi.fn(
            (
                _params: unknown,
                callbacks: { onSuccess: (data: unknown) => void }
            ) =>
                callbacks.onSuccess({
                    merchantId: "merchant-1",
                    hasMerchantAccess: true,
                })
        );
        mockPreview.mockReturnValue(previewState({ data: VALID_PREVIEW }));
        mockClaim.mockReturnValue({ mutate, isPending: false, error: null });

        render(<InviteAccept token="tok" />);

        expect(screen.getByText("auth.invite.title")).toBeInTheDocument();
        expect(screen.getByDisplayValue("invitee@test.com")).toBeDisabled();
        // The invite already carries the email — no name is ever asked.
        expect(
            screen.queryByLabelText("auth.invite.displayNamePlaceholder")
        ).not.toBeInTheDocument();

        fireEvent.change(
            screen.getByLabelText("auth.login.email.newPasswordPlaceholder"),
            { target: { value: "long-enough-password" } }
        );
        fireEvent.click(screen.getByText("auth.invite.submit"));

        expect(mutate).toHaveBeenCalledWith(
            { token: "tok", password: "long-enough-password" },
            expect.anything()
        );
        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith({
                to: "/m/$merchantId/dashboard",
                params: { merchantId: "merchant-1" },
            })
        );
    });

    test("navigates after claim even though claiming mints a session mid-flight", async () => {
        // Reproduces the reported bug: the claim's `setAuth` flips the store to
        // authenticated *before* `onSuccess` runs. The page must not bounce to
        // the "already authenticated" notice (which would unmount the form and
        // swallow the navigation) — the just-claimed invitee should be routed.
        const mutate = vi.fn(
            (
                _params: unknown,
                callbacks: { onSuccess: (data: unknown) => void }
            ) => {
                useAuthStore.getState().setAuth({
                    token: "fresh-session",
                    authMethod: "password",
                    expiresAt: Date.now() + 60_000,
                    pending2fa: false,
                });
                callbacks.onSuccess({
                    merchantId: "merchant-1",
                    hasMerchantAccess: true,
                });
            }
        );
        mockPreview.mockReturnValue(previewState({ data: VALID_PREVIEW }));
        mockClaim.mockReturnValue({ mutate, isPending: false, error: null });

        render(<InviteAccept token="tok" />);

        fireEvent.change(
            screen.getByLabelText("auth.login.email.newPasswordPlaceholder"),
            { target: { value: "long-enough-password" } }
        );
        fireEvent.click(screen.getByText("auth.invite.submit"));

        expect(
            screen.queryByText(/auth\.invite\.alreadyAuthenticated/)
        ).not.toBeInTheDocument();
        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith({
                to: "/m/$merchantId/dashboard",
                params: { merchantId: "merchant-1" },
            })
        );
    });

    test("routes a revoked invitee to the generic dashboard instead of a 403", () => {
        const mutate = vi.fn(
            (
                _params: unknown,
                callbacks: { onSuccess: (data: unknown) => void }
            ) =>
                callbacks.onSuccess({
                    merchantId: "merchant-1",
                    hasMerchantAccess: false,
                })
        );
        mockPreview.mockReturnValue(previewState({ data: VALID_PREVIEW }));
        mockClaim.mockReturnValue({ mutate, isPending: false, error: null });

        render(<InviteAccept token="tok" />);

        fireEvent.change(
            screen.getByLabelText("auth.login.email.newPasswordPlaceholder"),
            { target: { value: "long-enough-password" } }
        );
        fireEvent.click(screen.getByText("auth.invite.submit"));

        expect(mockNavigate).toHaveBeenCalledWith({ to: "/dashboard" });
    });

    test("keeps submit disabled below the minimum password length", () => {
        const mutate = vi.fn();
        mockPreview.mockReturnValue(previewState({ data: VALID_PREVIEW }));
        mockClaim.mockReturnValue({ mutate, isPending: false, error: null });

        render(<InviteAccept token="tok" />);

        fireEvent.change(
            screen.getByLabelText("auth.login.email.newPasswordPlaceholder"),
            { target: { value: "short" } }
        );
        const submit = screen.getByText("auth.invite.submit").closest("button");
        expect(submit).toBeDisabled();
    });
});
