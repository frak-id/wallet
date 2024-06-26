import { getSession } from "@/context/auth/actions/session";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RESTRICTED_ROUTES = ["/campaigns", "/dashboard"];

/**
 * Middleware configuration, excluding also /listener and /paywall
 */
export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|manifest.json|favicons).*)",
    ],
};

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const session = await getSession();

    // Redirect to dashboard if the user is authenticated
    if (pathname === "/login" && session) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Redirect to login if the user is not authenticated
    if (RESTRICTED_ROUTES.includes(pathname) && !session) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    // Redirect to the right page when trying to access the root
    if (pathname === "/") {
        return NextResponse.redirect(
            new URL(session ? "/dashboard" : "/login", req.url)
        );
    }
}
