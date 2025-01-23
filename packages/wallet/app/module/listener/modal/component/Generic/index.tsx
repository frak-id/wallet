import { Markdown } from "@/module/common/component/Markdown";
import { dismissModalBtnAtom } from "@/module/listener/modal/atoms/modalUtils";
import styles from "@/module/listener/modal/component/Modal/index.module.css";
import { useListenerTranslation } from "@/module/listener/providers/ListenerUiProvider";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { trackEvent } from "@module/utils/trackEvent";
import { useAtom } from "jotai";

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
    const { t } = useListenerTranslation();
    const [info, goToDismiss] = useAtom(dismissModalBtnAtom);
    // If not dismissible, or no dismiss step, return null
    if (!info) return null;

    // Otherwise, button that dismiss the current modal
    return (
        <button
            type={"button"}
            className={`${styles.modalListener__buttonLink} ${prefixModalCss("button-link")}`}
            onClick={() => {
                goToDismiss();
                trackEvent("cta-dismissed");
            }}
        >
            {info.customLbl ?? t("sdk.modal.default.dismissBtn")}
        </button>
    );
}
