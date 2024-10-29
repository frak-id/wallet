import { dismissModalBtnAtom } from "@/module/listener/atoms/modalUtils";
import styles from "@/module/listener/component/Modal/index.module.css";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useAtom } from "jotai";
import Markdown from "react-markdown";
import rehypeExternalLinks from "rehype-external-links";
import { useModalTranslation } from "../../hooks/useModalTranslation";

export function MetadataInfo({
    metadata,
    defaultDescription,
}: {
    metadata?: { description?: string };
    defaultDescription?: string;
}) {
    if (metadata?.description || defaultDescription) {
        return (
            <div
                className={`${styles.modalListener__text} ${prefixModalCss("text")}`}
            >
                <Markdown
                    rehypePlugins={[
                        [rehypeExternalLinks, { target: "_blank" }],
                    ]}
                >
                    {metadata?.description ?? defaultDescription}
                </Markdown>
            </div>
        );
    }
    return null;
}

/**
 * A generic dismiss button, if possible with the current request
 */
export function DismissButton() {
    const { t } = useModalTranslation();
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
