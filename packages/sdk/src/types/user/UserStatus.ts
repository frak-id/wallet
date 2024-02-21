import type { Address, Hex } from "viem";

export type GetUserStatusParam = Readonly<undefined>;

export type GetUserStatusResponse = Readonly<
    UserLoggedInStatus | UserNotLoggedIn
>;

export type UserLoggedInStatus = {
    key: "logged-in";
    wallet: Address;
    // The frk balance in wei
    frkBalanceAsHex: Hex;
};

export type UserNotLoggedIn = {
    key: "not-logged-in";
};
