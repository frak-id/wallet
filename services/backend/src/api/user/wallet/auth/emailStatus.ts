import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { AuthContext } from "../../../../domain/auth";

/**
 * Pre-registration check: lets the frontend warn a user before triggering
 * the WebAuthn ceremony if the email is already attached to a credential.
 * Strict format validation here is fine — no passkey has been created yet,
 * so a 422 just bounces the input back to the form.
 */
export const emailStatusRoutes = new Elysia().post(
    "/emailStatus",
    async ({ body: { email } }) => {
        const used =
            await AuthContext.repositories.authenticator.hasEmail(email);
        return { used };
    },
    {
        body: t.Object({
            email: t.String({ format: "email", maxLength: 320 }),
        }),
        response: {
            200: t.Object({ used: t.Boolean() }),
        },
    }
);
