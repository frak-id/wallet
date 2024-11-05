import { Markdown } from "@/module/common/component/Markdown";
import { dismissModalBtnAtom } from "@/module/listener/atoms/modalUtils";
import styles from "@/module/listener/component/Modal/index.module.css";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useAtom } from "jotai";
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
                    md={metadata?.description}
                    defaultTxt={defaultDescription}
                />
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
