import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { OrchestrationContext } from "../../../../orchestration/context";
import { EmailStatusResponseSchema } from "../../../schemas";

/**
 * Pre-registration check: lets the frontend warn a user before triggering
 * the WebAuthn ceremony if the email is already attached to a credential.
 *
 * Resolution path: `email identity node → group → wallet identity nodes →
 * authenticator bindings on active chain`. When the wallet has active
 * bindings the client receives every credential id so a targeted `login()`
 * can advertise all of them via WebAuthn's `allowCredentials` — a wallet
 * routinely accepts multiple passkeys after a merge.
 *
 * Strict format validation here is fine — no passkey has been created yet,
 * so a 422 just bounces the input back to the form.
 */
export const emailStatusRoutes = new Elysia().post(
    "/emailStatus",
    async ({ body: { email } }) => {
        const resolution =
            await OrchestrationContext.orchestrators.authenticatorLookup.resolveEmail(
                email
            );
        if (resolution.status === "available") {
            return { used: false } as const;
        }

        // A retired (`unavailable`) address is still taken but has no active
        // wallet to log into — report it used with an empty credential set.
        const authenticatorIds =
            resolution.status === "merge" ? resolution.authenticatorIds : [];
        return {
            used: true,
            authenticatorIds,
            // Backward-compat for old wallet apps that read a single
            // `authenticatorId` (see EmailStatusResponseSchema). New clients
            // read `authenticatorIds`.
            authenticatorId: authenticatorIds[0],
            wallet:
                resolution.status === "merge" ? resolution.wallet : undefined,
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
