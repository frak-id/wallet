import { sendPush } from "@/context/notification/action/sendPush";
import type { NotificationPayload } from "@frak-labs/shared/types/NotificationPayload";
import type { Address } from "viem";

export async function POST(request: Request) {
    const { pathname } = new URL(request.url);
    switch (pathname) {
        case "/api/web-push/send":
            return sendPushFromRequest(request);
        default:
            return notFoundApi();
    }
}

async function sendPushFromRequest(request: Request) {
    const body = (await request.json()) as {
        wallets: Address[];
        payload: NotificationPayload;
    };
    const { wallets, payload } = body;
    if (!(wallets?.length && payload)) {
        return new Response(JSON.stringify({ error: "Missing parameters" }), {
            headers: { "Content-Type": "application/json" },
            status: 403,
        });
    }
    await sendPush({ wallets, payload });
    return new Response(JSON.stringify({ message: "Push sent." }), {});
}

async function notFoundApi() {
    return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
        headers: { "Content-Type": "application/json" },
        status: 404,
    });
}
