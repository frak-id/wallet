import { Elysia } from "elysia";
import { identityApi } from "./identity";
import { userMerchantApi } from "./merchant";
import { trackApi } from "./track";
import { walletApi } from "./wallet";

export const userApi = new Elysia({ prefix: "/user" })
    .use(identityApi)
    .use(userMerchantApi)
    .use(trackApi)
    .use(walletApi);
