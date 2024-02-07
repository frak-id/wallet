import type { Hex } from "viem";

/**
 * The flow we want ->
 *   1. On news paper, click unlock with FRK
 *      a. If no account linked yet, give a few options to link an account and then to link the account
 *      b. If account linked, display the price options
 *   2. Redirect to the FRK Wallet with the rights options (prices and stuff)
 *   3. If requested, generate a signature to allow the user to read the news paper
 *   4. Then, recap the operations (article, article preview, prices etc) and ask for payment
 *   5. Once done, either embed or redirect to the article depending on the user choice
 *
 *   Idea for encoding:
 *     - https://github.com/pieroxy/lz-string
 *     - Base64 + keccak hash?
 *     -
 *
 */

/**
 * Request to unlock a content with Frak
 */
export type UnlockWithFrakRequest = Readonly<{
    articleId: Hex;
    contentId: Hex;
    // The url of the article to unlock
    articleUrl: string;
    // The url to display a preview of the content to be unlocked
    previewUrl?: string;
    // The url to redirect to after the content unlock process started
    redirectUrl: string;
    // The action to do post unlock
    unlockAction: ActionPostUnlock;
    // The title of the content to unlock
    errorAction: ActionPostUnlock;
}>;

type ActionPostUnlock = OpenAfterUnlock | EmbedAfterUnlock;

type OpenAfterUnlock = {
    key: "open";
    redirectUrl: string;
};

type EmbedAfterUnlock = {
    key: "embed";
    toDisplayUrl: string;
};
