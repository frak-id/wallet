import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia, status, t } from "elysia";
import type { ElysiaCookie } from "elysia/cookies";

const COOKIE_NAME = "frak_install_context";

const cookieConfig = {
    domain: isRunningLocally ? "localhost" : ".frak.id",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
    httpOnly: true,
    secure: !isRunningLocally,
    sameSite: "lax",
} satisfies ElysiaCookie;

export const mobileInstallContextRoutes = new Elysia({
    name: "Routes.mobileInstallContext",
    prefix: "/mobile/install-context",
})
    .post(
        "/store",
        ({ body, cookie }) => {
            cookie[COOKIE_NAME]?.set({
                value: JSON.stringify({
                    merchantId: body.merchantId,
                    anonymousId: body.anonymousId,
                }),
                ...cookieConfig,
            });
            return { success: true };
        },
        {
            body: t.Object({
                merchantId: t.String(),
                anonymousId: t.String(),
            }),
        }
    )
    .get(
        "/retrieve",
        ({ cookie }) => {
            const raw = cookie[COOKIE_NAME]?.value as string | undefined;
            if (!raw) {
                return status(404, "No data present in the cookie");
            }

            const context = JSON.parse(raw) as {
                merchantId: string;
                anonymousId: string;
            };

            cookie[COOKIE_NAME]?.set({
                value: "",
                ...cookieConfig,
                maxAge: 0,
            });

            return {
                merchantId: context.merchantId,
                anonymousId: context.anonymousId,
            };
        },
        {
            response: {
                404: t.String(),
                200: t.Object({
                    merchantId: t.String(),
                    anonymousId: t.String(),
                }),
            },
        }
    );
