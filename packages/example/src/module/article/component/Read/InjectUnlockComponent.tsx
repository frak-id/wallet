import { UnlockButtons } from "@/module/article/component/UnlockButtons";
import type { Article, ArticlePreparedForReading } from "@/type/Article";
import type {
    GetUnlockStatusResponse,
    GetUserStatusResponse,
    UnlockRequestResult,
} from "@frak-wallet/sdk";
import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price";
import React from "react";
import { createPortal } from "react-dom";

const selectorsLeMonde = {
    locked: { selector: ".lmd-paywall", position: "afterbegin" },
    unlocked: { selector: ".article__reactions", position: "beforebegin" },
};

const selectorsWired = {
    locked: { selector: ".egookh", position: "afterbegin" },
    unlocked: { selector: ".article__reactions", position: "beforebegin" },
};

function getSelectors(provider: Article["provider"]) {
    switch (provider) {
        case "le-monde":
            return selectorsLeMonde;
        case "wired":
            return selectorsWired;
    }
}

export function InjectUnlockComponent({
    prices,
    unlockStatus,
    userStatus,
    article,
}: {
    prices: ArticlePriceForUser[];
    unlockStatus: GetUnlockStatusResponse | UnlockRequestResult | undefined;
    userStatus: GetUserStatusResponse | undefined;
    article: ArticlePreparedForReading;
}) {
    const articleIframe = document.querySelector(
        "#frak-article-iframe"
    ) as HTMLIFrameElement | null;
    const selectors = getSelectors(article?.provider);
    const currentSelector =
        selectors[unlockStatus?.key === "valid" ? "unlocked" : "locked"];
    const containerName = "frak-paywall";
    let containerRoot =
        articleIframe?.contentWindow?.document.getElementById(containerName);
    if (!containerRoot) {
        const appRoot = document.createElement("div");
        appRoot.id = containerName;
        const element = articleIframe?.contentWindow?.document.querySelector(
            currentSelector.selector
        );
        element?.insertAdjacentElement(
            currentSelector.position as InsertPosition,
            appRoot
        );
        containerRoot =
            articleIframe?.contentWindow?.document.getElementById(
                containerName
            );
    }

    if (!containerRoot) {
        console.log("Element frak-paywall not found");
        return;
    }

    containerRoot.style.width = "100%";

    return createPortal(
        <UnlockButtons
            prices={prices}
            unlockStatus={unlockStatus}
            userStatus={userStatus}
            article={article}
        />,
        containerRoot
    );
}
