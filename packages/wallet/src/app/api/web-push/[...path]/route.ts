import { Config } from "sst/node/config";
import webpush from "web-push";

webpush.setVapidDetails(
    "mailto:mail@example.com",
    Config.VAPID_PUBLIC_KEY as string,
    Config.VAPID_PRIVATE_KEY as string
);

export async function POST(request: Request) {
    const { pathname } = new URL(request.url);
    switch (pathname) {
        case "/api/web-push/send":
            return sendPush(request);
        default:
            return notFoundApi();
    }
}

async function sendPush(request: Request) {
    const body = await request.json();
    console.log("body", body);
    const { subscription, payload } = body;
    const pushPayload = JSON.stringify(payload);
    await webpush.sendNotification(subscription, pushPayload);
    return new Response(JSON.stringify({ message: "Push sent." }), {});
}

async function notFoundApi() {
    return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
        headers: { "Content-Type": "application/json" },
        status: 404,
    });
}
