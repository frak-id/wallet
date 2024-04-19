import { UnlockButtons } from "@/module/article/component/UnlockButtons";
import { cssRaw as cssRaw2 } from "@/module/common/component/Button";
import type { Article } from "@/type/Article";
import type { UnlockOptionsReturnType } from "@frak-labs/nexus-sdk/core";
import type {
    ArticleUnlockStatusQueryReturnType,
    WalletStatusQueryReturnType,
} from "@frak-labs/nexus-sdk/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cssRaw } from "../UnlockButtons";

const selectorsLeMonde = {
    locked: { selector: ".lmd-paywall", position: "afterbegin" },
    unlocked: { selector: ".article__reactions", position: "beforebegin" },
};

const selectorsWired = {
    locked: {
        selector: ".PaywallBarContentContainer-geBYFf",
        position: "afterbegin",
    },
    unlocked: {
        selector: ".body__inline-barrier",
        position: "afterbegin",
    },
};

const selectorsLEquipe = {
    locked: {
        selector: ".js-paywall",
        position: "beforebegin",
    },
    unlocked: {
        selector: ".Article__relatedTags",
        position: "afterend",
    },
};

function getSelectors(provider: Article["provider"]) {
    switch (provider) {
        case "le-monde":
            return selectorsLeMonde;
        case "wired":
            return selectorsWired;
        case "l-equipe":
            return selectorsLEquipe;
    }
}

function findSelector(
    currentSelector: { selector: string; position: string },
    articleIframeDocument: Document | undefined
) {
    const element = articleIframeDocument?.querySelector(
        currentSelector.selector
    );
    if (!element) {
        return null;
    }
    return element;
}

export function InjectUnlockComponent({
    prices,
    unlockStatus,
    walletStatus,
    article,
}: {
    prices: UnlockOptionsReturnType["prices"];
    unlockStatus: ArticleUnlockStatusQueryReturnType | undefined | null;
    walletStatus: WalletStatusQueryReturnType | undefined;
    article: Article;
}) {
    const [element, setElement] = useState<Element | undefined>();
    const [containerRoot, setContainerRoot] = useState<Element | undefined>();

    // Get the article's iframe
    const articleIframeName = "frak-article-iframe";
    const articleIframe = document.querySelector(
        `#${articleIframeName}`
    ) as HTMLIFrameElement;
    const articleIframeDocument = articleIframe?.contentWindow?.document;

    // Selectors to be queried for the unlock component
    const selectors = getSelectors(article?.provider);
    const currentSelector =
        selectors[unlockStatus?.status === "unlocked" ? "unlocked" : "locked"];

    useEffect(() => {
        const interval = setInterval(() => {
            const found = findSelector(currentSelector, articleIframeDocument);
            if (found) {
                clearInterval(interval);
                clearTimeout(timeout);
                setElement(found);
            }
        }, 1000);
        const timeout = setTimeout(() => {
            // Once we reached 10sec, abort element search
            clearInterval(interval);
        }, 10_000);
        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [currentSelector, articleIframeDocument]);

    useEffect(() => {
        if (!element) return;

        const containerName = "frak-paywall";
        let containerRoot =
            articleIframeDocument?.getElementById(containerName);

        // If the container does not exist, create it
        if (!containerRoot) {
            const appRoot = document.createElement("div");
            appRoot.id = containerName;
            element?.insertAdjacentElement(
                currentSelector.position as InsertPosition,
                appRoot
            );
            containerRoot =
                articleIframeDocument?.getElementById(containerName);

            if (containerRoot) {
                containerRoot.style.width = "100%";
                setContainerRoot(containerRoot);
            }
        }
    }, [element, currentSelector, articleIframeDocument]);

    if (
        !(
            articleIframe &&
            articleIframeDocument &&
            articleIframe.contentDocument
        )
    ) {
        console.log(`iframe ${articleIframeName} not found`);
        return null;
    }

    return (
        containerRoot && (
            <>
                {createPortal(
                    <UnlockButtons
                        prices={prices}
                        unlockStatus={unlockStatus}
                        walletStatus={walletStatus}
                        article={article}
                    />,
                    containerRoot
                )}
                {/* Inject the styles into the iframe */}
                {createPortal(
                    <style>
                        {cssRaw.toString()}
                        {cssRaw2.toString()}
                    </style>,
                    articleIframe.contentDocument.head
                )}
            </>
        )
    );
}
