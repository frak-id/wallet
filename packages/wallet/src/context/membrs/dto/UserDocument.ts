import type { Hex } from "viem";

export type UserDocument = Readonly<{
    // The id of the user (wallet address)
    _id: Hex;
    // Username of the user
    username: string;
    // Photo of the user
    photo?: string;
}>;
