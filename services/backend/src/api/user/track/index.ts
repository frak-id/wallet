import { Elysia } from "elysia";
import { trackInteractionRoute } from "./interaction";
import { trackPurchaseRoute } from "./purchase";

export const trackApi = new Elysia({ prefix: "/track" })
    .use(trackInteractionRoute)
    .use(trackPurchaseRoute);
