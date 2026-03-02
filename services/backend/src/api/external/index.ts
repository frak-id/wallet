import { Elysia } from "elysia";
import { merchantApi } from "./merchant";

export const externalApi = new Elysia({ prefix: "/ext" }).use(merchantApi);
