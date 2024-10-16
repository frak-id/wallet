import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_ROUTES = ["/login", "/register", "/recovery", "/sso"];
const RESTRICTED_ROUTES = ["/history", "/settings", "/tokens", "/wallet"];

/**
 * Middleware configuration, excluding also /listener
 */
export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|manifest.json|favicons|listener).*)",
    ],
};

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const walletCookie = req.cookies.get("walletAuth");
    const isAuthenticated = walletCookie !== undefined;

    /**
     * Redirect to wallet if the user is authenticated
     */
    if (AUTH_ROUTES.includes(pathname) && isAuthenticated) {
        return NextResponse.redirect(new URL("/wallet", req.url));
    }

    /**
     * Redirect to register if the user is not authenticated
     */
    if (RESTRICTED_ROUTES.includes(pathname) && !isAuthenticated) {
        return NextResponse.redirect(new URL("/register", req.url));
    }

    /**
     * Redirect to wallet or register if the user is on the root path
     */
    if (pathname === "/") {
        return NextResponse.redirect(
            new URL(isAuthenticated ? "/wallet" : "/register", req.url)
        );
    }
}
