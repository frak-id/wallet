import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { OrchestrationContext } from "../../../../orchestration/context";
import { EmailStatusResponseSchema } from "../../../schemas";

/**
 * Pre-registration check: lets the frontend warn a user before triggering
 * the WebAuthn ceremony if the email is already attached to a credential.
 *
 * Resolution path: `email identity node → group → wallet identity node →
 * authenticator binding on active chain`. When the wallet has an active
 * binding the client receives the credential id so a targeted `login()` can
 * skip the WebAuthn account chooser on platforms that honor `credentialId`.
 *
 * Strict format validation here is fine — no passkey has been created yet,
 * so a 422 just bounces the input back to the form.
 */
export const emailStatusRoutes = new Elysia().post(
    "/emailStatus",
    async ({ body: { email } }) => {
        const lookup =
            await OrchestrationContext.orchestrators.authenticatorLookup.findByEmail(
                email
            );
        if (!lookup) {
            return { used: false } as const;
        }

        return {
            used: true,
            authenticatorId: lookup.authenticatorId,
            wallet: lookup.wallet,
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
