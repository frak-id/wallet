import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia, status, t } from "elysia";
import type { ElysiaCookie } from "elysia/cookies";

const cookieConfig = {
    domain: isRunningLocally ? "localhost" : ".frak.id",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
    httpOnly: true,
    secure: !isRunningLocally,
    sameSite: "lax",
} satisfies ElysiaCookie;

const InstallContextCookieSchema = t.Object({
    merchantId: t.String(),
    anonymousId: t.String(),
});

export const mobileInstallContextRoutes = new Elysia({
    name: "Routes.mobileInstallContext",
    prefix: "/mobile/install-context",
})
    .post(
        "/store",
        ({ body, cookie: { frak_install_context } }) => {
            frak_install_context.set({
                value: {
                    merchantId: body.merchantId,
                    anonymousId: body.anonymousId,
                },
                ...cookieConfig,
            });
            return { success: true };
        },
        {
            body: t.Object({
                merchantId: t.String(),
                anonymousId: t.String(),
            }),
            cookie: t.Cookie({
                frak_install_context: t.Optional(InstallContextCookieSchema),
            }),
        }
    )
    .get(
        "/retrieve",
        ({ cookie: { frak_install_context } }) => {
            if (!frak_install_context.value) {
                return status(404, "No data present in the cookie");
            }

            return frak_install_context.value;
        },
        {
            response: {
                404: t.String(),
                200: t.Object({
                    merchantId: t.String(),
                    anonymousId: t.String(),
                }),
            },
            cookie: t.Cookie({
                frak_install_context: t.Optional(InstallContextCookieSchema),
            }),
        }
    );
