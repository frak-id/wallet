import { t } from "@backend-utils";
import { currentChainId } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import { AuthContext } from "../../../../domain/auth";
import { EmailStatusResponseSchema } from "../../../schemas";

/**
 * Pre-registration check: lets the frontend warn a user before triggering
 * the WebAuthn ceremony if the email is already attached to a credential.
 * When the email matches, also returns the credential + wallet pair so the
 * client can run a targeted `login()` (skipping a WebAuthn account chooser
 * on platforms that honor `credentialId`).
 * Strict format validation here is fine — no passkey has been created yet,
 * so a 422 just bounces the input back to the form.
 */
export const emailStatusRoutes = new Elysia().post(
    "/emailStatus",
    async ({ body: { email } }) => {
        const match = await AuthContext.repositories.authenticator.findByEmail({
            chainId: currentChainId,
            email,
        });
        if (!match) {
            return { used: false } as const;
        }
        return {
            used: true,
            authenticatorId: match.authenticatorId,
            wallet: match.smartWalletAddress ?? undefined,
        } as const;
    },
    {
        body: t.Object({
            email: t.String({ format: "email", maxLength: 320 }),
        }),
        response: {
            200: EmailStatusResponseSchema,
        },
    }
);
