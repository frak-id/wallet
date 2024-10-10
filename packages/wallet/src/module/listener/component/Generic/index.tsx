import { Title } from "@/module/common/component/Title";
import { dismissBtnAtom } from "@/module/listener/atoms/modalEvents";
import styles from "@/module/listener/component/Modal/index.module.css";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useAtom } from "jotai";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import rehypeExternalLinks from "rehype-external-links";

export function MetadataInfo({
    metadata,
    defaultTitle,
    defaultDescription,
}: {
    metadata?: { title?: string; description?: string };
    defaultTitle?: ReactNode;
    defaultDescription: ReactNode;
}) {
    return (
        <>
            <MetadataSubtitle
                metadataTitle={metadata?.title}
                defaultText={defaultTitle}
            />
            <MetadataDescription
                metadataDescription={metadata?.description}
                defaultText={defaultDescription}
            />
        </>
    );
}

function MetadataDescription({
    metadataDescription,
    defaultText,
}: { metadataDescription?: string; defaultText: ReactNode }) {
    if (metadataDescription) {
        return (
            <div
                className={`${styles.modalListener__text} ${prefixModalCss("text")}`}
            >
                <Markdown
                    rehypePlugins={[
                        [rehypeExternalLinks, { target: "_blank" }],
                    ]}
                >
                    {metadataDescription}
                </Markdown>
            </div>
        );
    }
    return (
        <div
            className={`${styles.modalListener__text} ${prefixModalCss("text")}`}
        >
            <p>{defaultText}</p>
        </div>
    );
}

function MetadataSubtitle({
    metadataTitle,
    defaultText,
}: { metadataTitle?: string; defaultText?: ReactNode }) {
    if (!(metadataTitle || defaultText)) return null;

    return (
        <Title className={styles.modalListener__subTitle}>
            {metadataTitle ?? defaultText}
        </Title>
    );
}

/**
 * A generic dismiss button, if possible with the current request
 */
export function DismissButton() {
    const { t } = useTranslation();
    const [info, goToDismiss] = useAtom(dismissBtnAtom);
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
