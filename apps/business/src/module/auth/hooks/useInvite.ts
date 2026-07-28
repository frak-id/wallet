import { useMutation, useQuery } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import {
    AuthError,
    extractAuthErrorCode,
    extractAuthErrorMessage,
} from "@/module/auth/utils/authError";
import { useAuthStore } from "@/stores/authStore";
import { invitePreviewQueryKey } from "./queryKeys";

const GENERIC_INVALID_TOKEN = "This invitation link is invalid or has expired";

/**
 * `POST /auth/invite/preview` — resolves a merchant-team invitation token to
 * its display context (email, merchant, inviter) without claiming it. Public,
 * session-agnostic; any invalid/expired token surfaces the same generic
 * error (enumeration-safe). `useQuery` (not `useMutation`) so a transient
 * network failure is retried/refetchable instead of permanently latching
 * into "invalid or expired" — only the backend's `INVALID_INVITATION` code
 * should render as that terminal state.
 */
export function useInvitePreview(token: string | undefined) {
    return useQuery({
        queryKey: invitePreviewQueryKey(token),
        enabled: Boolean(token),
        // Retry transient failures (network/5xx), but not a definitive
        // rejection from the backend (bad/expired token) — those should
        // render the terminal "invalid invitation" state immediately.
        retry: (failureCount, error) =>
            !(error instanceof AuthError) && failureCount < 2,
        queryFn: async () => {
            const { data, error } =
                await authenticatedBackendApi.auth.invite.preview.post({
                    // biome-ignore lint/style/noNonNullAssertion: gated by `enabled`
                    token: token!,
                });
            if (error) {
                throw new AuthError(
                    extractAuthErrorMessage(error, GENERIC_INVALID_TOKEN),
                    extractAuthErrorCode(error)
                );
            }
            return data;
        },
    });
}

/**
 * `POST /auth/invite/claim` — sets the credential on the pre-created
 * (credential-less) invited account and returns a fully 2FA-verified
 * session: clicking the emailed link is itself the email-ownership proof, so
 * there is no separate `/login/2fa` step for this flow.
 */
export function useInviteClaim() {
    return useMutation({
        mutationKey: ["auth", "invite", "claim"],
        mutationFn: async (params: { token: string; password: string }) => {
            const { data, error } =
                await authenticatedBackendApi.auth.invite.claim.post(params);
            if (error) {
                throw new AuthError(
                    extractAuthErrorMessage(error, GENERIC_INVALID_TOKEN),
                    extractAuthErrorCode(error)
                );
            }

            useAuthStore.getState().setAuth({
                token: data.token,
                accountId: data.accountId,
                authMethod: "password",
                expiresAt: data.expiresAt,
                pending2fa: false,
            });

            return data;
        },
    });
}
