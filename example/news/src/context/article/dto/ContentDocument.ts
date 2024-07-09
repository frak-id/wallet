import type { Hex } from "viem";

export type ContentDocument = Readonly<{
    // The id of the content (an hex string, representing a bigint)
    _id: Hex;
    // The title of the content
    title: string;
}>;
