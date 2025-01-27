import { iframeResolvingContextAtom } from "@/module/atoms/resolvingContext";
import { Markdown } from "@/module/common/component/Markdown";
import { SsoButton } from "@/module/listener/component/SsoButton";
import {
    useListenerTranslation,
    useListenerUI,
} from "@/module/listener/providers/ListenerUiProvider";
import { prefixWalletCss } from "@module/utils/prefixWalletCss";
import { useAtomValue } from "jotai";
import styles from "./index.module.css";

/**
 * View for the logged out user
 * @constructor
 */
export function LoggedOutComponent() {
    const { currentRequest } = useListenerUI();
    const { metadata, loggedOut } =
        currentRequest?.type === "embeded" ? currentRequest.params : {};
    const { t } = useListenerTranslation();
    const productId = useAtomValue(iframeResolvingContextAtom)?.productId;

    return (
        <>
            <div className={styles.modalListenerWallet__text}>
                <Markdown
                    md={loggedOut?.metadata?.text}
                    defaultTxt={t("sdk.wallet.login.default.text")}
                />
            </div>
            {productId && (
                <SsoButton
                    productId={productId}
                    ssoMetadata={{
                        logoUrl: metadata?.logo,
                        homepageLink: metadata?.homepageLink,
                    }}
                    text={loggedOut?.metadata?.buttonText}
                    defaultText={t("sdk.wallet.login.default.primaryAction")}
                    className={`${styles.modalListenerWallet__buttonPrimary} ${prefixWalletCss("button-primary")}`}
                />
            )}
        </>
    );
}
