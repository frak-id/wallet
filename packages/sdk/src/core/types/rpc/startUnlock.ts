import type { Address, Hex } from "viem";
import type { PaidArticleUnlockPrice } from "../generic";

/**
 * Request to unlock a paid article
 */
export type StartArticleUnlockParams = Readonly<{
    articleId: Hex;
    contentId: Hex;
    imageUrl: string;
    // The displayable article and content title
    articleTitle: string;
    contentTitle: string;
    // The selected prices for the article
    price: PaidArticleUnlockPrice;
    // Url of the article to unlock
    articleUrl: string;
    // The url to redirect to after the content unlock process started
    redirectUrl: string;
    // The url to display a preview of the content to be unlocked
    previewUrl?: string;
}>;

/**
 * Return type of the unlock request
 */
export type StartArticleUnlockReturnType =
    | UnlockSuccess
    | AlreadyUnlocked
    | UnlockError;

type UnlockSuccess = {
    key: "success";
    status: "in-progress";
    user: Address;
    userOpHash: Hex;
};

type AlreadyUnlocked = {
    key: "already-unlocked";
    status: "unlocked";
    user: Address;
};

type UnlockError = {
    key: "error" | "cancelled";
    status: "locked";
    user?: Address;
    reason?: string;
};
