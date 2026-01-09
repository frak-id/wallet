import { Elysia } from "elysia";
import { trackArrivalRoute } from "./arrival";
import { trackPurchaseRoute } from "./purchase";

export const trackApi = new Elysia({ prefix: "/track" })
    .use(trackArrivalRoute)
    .use(trackPurchaseRoute);
