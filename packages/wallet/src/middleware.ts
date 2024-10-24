import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware configuration, excluding also /listener
 */
export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|manifest.json|favicons|listener|sw.js).*)",
    ],
};

export async function middleware(req: NextRequest) {
    /**
     * Redirect to wallet by default
     */
    if (req.nextUrl.pathname === "/") {
        return NextResponse.redirect(new URL("/wallet", req.url));
    }
}
