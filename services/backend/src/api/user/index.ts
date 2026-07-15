import { Elysia } from "elysia";
import { userAffiliateApi } from "./affiliate";
import { identityApi } from "./identity";
import { userMerchantApi } from "./merchant";
import { trackApi } from "./track";
import { walletApi } from "./wallet";

export const userApi = new Elysia({ prefix: "/user" })
    .use(identityApi)
    .use(userMerchantApi)
    .use(userAffiliateApi)
    .use(trackApi)
    .use(walletApi);
