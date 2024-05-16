import { Popup } from "@/module/article/component/Popup";
import { cssRaw as cssRawButton } from "@/module/common/component/Button";
import type { Article } from "@/type/Article";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cssRaw } from "../Popup";

export function InjectPopupComponent({
    article,
}: {
    article: Article;
}) {
    const [containerRoot, setContainerRoot] = useState<Element | undefined>();

    // Get the article's iframe
    const articleIframeName = "frak-article-iframe";
    const articleIframe = document.querySelector(
        `#${articleIframeName}`
    ) as HTMLIFrameElement;
    const articleIframeDocument = articleIframe?.contentWindow?.document;

    useEffect(() => {
        const containerName = "frak-popup";
        let containerRoot =
            articleIframeDocument?.getElementById(containerName);

        // If the container does not exist, create it
        if (!containerRoot) {
            const appRoot = document.createElement("div");
            appRoot.id = containerName;
            articleIframeDocument?.body?.insertAdjacentElement(
                "beforeend",
                appRoot
            );
            containerRoot =
                articleIframeDocument?.getElementById(containerName);

            if (containerRoot) {
                containerRoot.style.width = "100%";
                setContainerRoot(containerRoot);
            }
        }
    }, [articleIframeDocument]);

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
                {createPortal(<Popup article={article} />, containerRoot)}
                {/* Inject the styles into the iframe */}
                {createPortal(
                    <style>
                        {cssRaw.toString()}
                        {cssRawButton.toString()}
                    </style>,
                    articleIframe.contentDocument.head
                )}
            </>
        )
    );
}
