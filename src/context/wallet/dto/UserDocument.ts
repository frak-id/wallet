import type { ObjectId } from "mongodb";

/**
 * Represent a pending challenge for a user
 */
export type UserDocument = Readonly<{
    // This is the challenge itself
    _id?: ObjectId;
    // His username
    username: string;
    // The list of all the current challenges
    challenges?: string[];
}>;
