import { Elysia, t } from "elysia";

export const socialRoute = new Elysia({ name: "Routes.social" }).get(
    "/social",
    async ({ query: { u }, headers }) => {
        const ua = headers["user-agent"]?.toLocaleLowerCase();

        // If no user agent present, redirect to the url
        if (!ua) {
            return Response.redirect(u);
        }

        // Check if we are in a meta embedded browser
        const isMeta =
            ua.includes("instagram") ||
            ua.includes("fban") ||
            ua.includes("fbav") ||
            ua.includes("facebook");

        // If we are not in a meta embeded browser, redirect to the url
        if (!isMeta) {
            return Response.redirect(u);
        }

        const isIOS = ua.includes("iphone") || ua.includes("ipad");

        // If we are in a meta embeded browser + ios, redirect to the url using safari
        if (isIOS) {
            // iOS: Use x-safari-https scheme to open in Safari
            const targetUrl = new URL(u);
            return Response.redirect(
                `x-safari-https://${targetUrl.host}${targetUrl.pathname}${targetUrl.search}`,
                302
            );
        }

        // Otherwise, fake the download of a pdf to force exit to the default browser
        return new Response("", {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": 'inline; filename="dummy"',
                "Content-Transfer-Encoding": "binary",
                "Accept-Ranges": "bytes",
            },
        });
    },
    {
        query: t.Object({
            u: t.String(),
        }),
    }
);
