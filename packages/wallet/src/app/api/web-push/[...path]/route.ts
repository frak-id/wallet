import { Config } from "sst/node/config";
import webpush, { type PushSubscription } from "web-push";

webpush.setVapidDetails(
    "mailto:mail@example.com",
    Config.VAPID_PUBLIC_KEY as string,
    Config.VAPID_PRIVATE_KEY as string
);

let subscription: PushSubscription & { keys: { p256dh: string; auth: string } };

export async function POST(request: Request) {
    const { pathname } = new URL(request.url);
    switch (pathname) {
        case "/api/web-push/subscription":
            return setSubscription(request);
        case "/api/web-push/send":
            return sendPush(request);
        default:
            return notFoundApi();
    }
}

async function setSubscription(request: Request) {
    const body: {
        subscription: PushSubscription & {
            keys: { p256dh: string; auth: string };
        };
    } = await request.json();
    subscription = body.subscription;
    return new Response(JSON.stringify({ message: "Subscription set." }), {});
}

async function sendPush(request: Request) {
    console.log(subscription, "subs");
    const body = await request.json();
    const pushPayload = JSON.stringify(body);
    await webpush.sendNotification(subscription, pushPayload);
    return new Response(JSON.stringify({ message: "Push sent." }), {});
}

async function notFoundApi() {
    return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
        headers: { "Content-Type": "application/json" },
        status: 404,
    });
}
