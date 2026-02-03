import { Elysia } from "elysia";
import { trackArrivalRoute } from "./arrival";
import { trackInteractionRoute } from "./interaction";
import { trackPurchaseRoute } from "./purchase";
import { trackSharingRoute } from "./sharing";

export const trackApi = new Elysia({ prefix: "/track" })
    .use(trackInteractionRoute)
    .use(trackArrivalRoute)
    .use(trackPurchaseRoute)
    .use(trackSharingRoute);
