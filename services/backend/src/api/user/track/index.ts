import { Elysia } from "elysia";
import { trackArrivalRoute } from "./arrival";
import { trackPurchaseRoute } from "./purchase";
import { trackSharingRoute } from "./sharing";

export const trackApi = new Elysia({ prefix: "/track" })
    .use(trackArrivalRoute)
    .use(trackPurchaseRoute)
    .use(trackSharingRoute);
