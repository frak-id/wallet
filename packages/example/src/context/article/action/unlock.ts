"use server";

import { getUnlockRequestUrl } from "@frak-wallet/sdk";

/**
 * Generate a mocked unlock link
 */
export async function getMockedUnlockLink() {
    return getUnlockRequestUrl(
        {
            walletUrl: process.env.FRAK_WALLET_URL as string,
        },
        {
            articleId: "0xdeadbeef",
            contentId: "0xdeadbeef",
            price: {
                index: 0,
                unlockDurationInSec: 0,
                frkAmount: "0x0",
            },
            articleUrl: "https://path-to-the-article.com/",
            redirectUrl:
                "https://path-to-the-article.with-unlock-handling.com/",
        }
    );
}
