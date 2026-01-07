import { Elysia } from "elysia";
import { trackArrivalRoute } from "./arrival";

export const trackApi = new Elysia({ prefix: "/track" }).use(trackArrivalRoute);
