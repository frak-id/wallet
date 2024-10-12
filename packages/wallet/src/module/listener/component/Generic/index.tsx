import { dismissModalBtnAtom } from "@/module/listener/atoms/modalUtils";
import styles from "@/module/listener/component/Modal/index.module.css";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useAtom } from "jotai";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import rehypeExternalLinks from "rehype-external-links";

export function MetadataInfo({
    metadata,
    defaultDescription,
}: {
    metadata?: { description?: string };
    defaultDescription: ReactNode;
}) {
    if (metadata?.description) {
        return (
            <div
                className={`${styles.modalListener__text} ${prefixModalCss("text")}`}
            >
                <Markdown
                    rehypePlugins={[
                        [rehypeExternalLinks, { target: "_blank" }],
                    ]}
                >
                    {metadata?.description}
                </Markdown>
            </div>
        );
    }
    return (
        <div
            className={`${styles.modalListener__text} ${prefixModalCss("text")}`}
        >
            <p>{defaultDescription}</p>
        </div>
    );
}

/**
 * A generic dismiss button, if possible with the current request
 */
export function DismissButton() {
    const { t } = useTranslation();
    const [info, goToDismiss] = useAtom(dismissModalBtnAtom);
    // If not dismissible, or no dismiss step, return null
    if (!info) return null;

    // Otherwise, button that dismiss the current modal
    return (
        <button
            type={"button"}
            className={`${styles.modalListener__buttonLink} ${prefixModalCss("button-link")}`}
            onClick={() => goToDismiss()}
        >
            {info.customLbl ?? t("sdk.modal.default.dismissBtn")}
        </button>
    );
}
