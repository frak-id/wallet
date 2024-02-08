"use server";

import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { getUnlockRequestUrl } from "@frak-wallet/sdk";
import { keccak256 } from "viem";

/**
 * Generate a mocked unlock link
 */
export async function getMockedUnlockLink() {
    return getUnlockRequestUrl(frakWalletSdkConfig, {
        articleId: keccak256("0xdeadbeef"),
        articleTitle: "Example Article",
        price: {
            index: 0,
            unlockDurationInSec: 0,
            frkAmount: "0x0",
        },
        articleUrl: "https://path-to-the-article.com/",
        redirectUrl:
            "https://wallet-example.frak.id/articles/0x7cc3567eb1c096b67f36d70b209016769bf6e45934ad62abaacb20a3c681de27",
    });
}
