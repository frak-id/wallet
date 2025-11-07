import { isRunningInProd, isRunningLocally } from "@frak-labs/app-essentials";
import type { SessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import { cookies, headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import type { Address, Hex } from "viem";

/**
 * Hardcoded demo wallet address (from mock campaign data)
 */
const DEMO_WALLET_ADDRESS: Address =
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0";

/**
 * Session options for iron-session
 */
const sessionOptions: SessionOptions = {
    password: process.env.SESSION_ENCRYPTION_KEY ?? "",
    cookieName: "businessSession",
    ttl: 60 * 60 * 24 * 7, // 1 week
    cookieOptions: {
        secure: true,
        sameSite: "none",
        domain: isRunningLocally ? "localhost" : ".frak.id",
    },
};

/**
 * Demo route handler that automatically activates demo mode and logs in
 * Access via: http://localhost:3001/demo or https://business-dev.frak.id/demo
 */
export async function GET(_request: NextRequest) {
    // Only allow in development and staging (block production)
    if (isRunningInProd) {
        return new NextResponse("Demo mode not available in production", {
            status: 403,
        });
    }

    const cookieStore = await cookies();
    const headersList = await headers();

    // Get the current domain from the request
    const host = headersList.get("host") ?? "localhost:3001";
    const protocol = isRunningLocally ? "http" : "https";
    const origin = `${protocol}://${host}`;

    // Create mock SIWE message following EIP-4361 format exactly
    const expirationTime = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const issuedAt = new Date();

    // Format: {domain} wants you to sign in with your Ethereum account:\n{address}\n\n{statement}\n\n{fields}
    const mockSiweMessage = `${host} wants you to sign in with your Ethereum account:
${DEMO_WALLET_ADDRESS}

Demo Mode Session

URI: ${origin}
Version: 1
Chain ID: 1
Nonce: demo${Date.now()}
Issued At: ${issuedAt.toISOString()}
Expiration Time: ${expirationTime.toISOString()}`;

    const mockSignature: Hex =
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    // Create session
    const session = await getIronSession<{
        wallet: Address;
        siwe: { message: string; signature: Hex };
    }>(cookieStore, sessionOptions);

    session.wallet = DEMO_WALLET_ADDRESS;
    session.siwe = {
        message: mockSiweMessage,
        signature: mockSignature,
    };
    await session.save();

    // Set demo mode cookie AFTER session save
    cookieStore.set("business_demoMode", "true", {
        path: "/",
        maxAge: 31536000, // 1 year
        sameSite: "lax",
        httpOnly: false,
    });

    // Return HTML with client-side redirect
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Activating Demo Mode...</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #0b1f3d;
            background-image: url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUxOSIgaGVpZ2h0PSIxMDg3IiB2aWV3Qm94PSIwIDAgMTUxOSAxMDg3IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTUxOSIgaGVpZ2h0PSIxMDg3IiBmaWxsPSJ1cmwoI3BhaW50MF9yYWRpYWxfOTg2MF8yNjc0KSIvPgo8ZGVmcz4KPHJhZGlhbEdyYWRpZW50IGlkPSJwYWludDBfcmFkaWFsXzk4NjBfMjY3NCIgY3g9IjAiIGN5PSIwIiByPSIxIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgZ3JhZGllbnRUcmFuc2Zvcm09InRyYW5zbGF0ZSgzOTAuMzQ4IDQ5Mi4xMjQpIHJvdGF0ZSgyMC4yODMxKSBzY2FsZSgxNDQ0LjMgNDI3LjYzNykiPgo8c3RvcCBzdG9wLWNvbG9yPSIjMTk0MzgwIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzAzMTkzQSIvPgo8L3JhZGlhbEdyYWRpZW50Pgo8L2RlZnM+Cjwvc3ZnPgo=");
            background-size: cover;
            background-attachment: fixed;
            color: #fff;
        }
        .container {
            text-align: center;
        }
        .spinner {
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top: 3px solid #4169e1;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <p>Activating demo mode...</p>
    </div>
    <script>
        // Set demo mode in localStorage using Zustand persist format
        const demoModeState = {
            state: {
                isDemoMode: true
            },
            version: 0
        };
        localStorage.setItem('business_demoMode', JSON.stringify(demoModeState));

        // Give browser time to process cookies and localStorage before redirect
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 500);
    </script>
</body>
</html>`;

    return new NextResponse(html, {
        headers: {
            "Content-Type": "text/html",
        },
    });
}
