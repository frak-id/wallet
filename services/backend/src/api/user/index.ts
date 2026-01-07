import { Elysia } from "elysia";
import { trackApi } from "./track";
import { walletApi } from "./wallet";

export const userApi = new Elysia({ prefix: "/user" })
    .use(trackApi)
    .use(walletApi);
