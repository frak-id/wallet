import { Markdown } from "@/module/common/component/Markdown";
import { useSafeResolvingContext } from "@/module/listener/atoms/resolvingContext";
import { SsoButton } from "@/module/listener/component/SsoButton";
import {
    useEmbededListenerUI,
    useListenerTranslation,
} from "@/module/listener/providers/ListenerUiProvider";
import { prefixWalletCss } from "@module/utils/prefixWalletCss";
import styles from "./index.module.css";

/**
 * View for the logged out user
 * @constructor
 */
export function LoggedOutComponent() {
    const {
        currentRequest: {
            params: { metadata, loggedOut },
        },
    } = useEmbededListenerUI();
    const { t } = useListenerTranslation();
    const productId = useSafeResolvingContext()?.productId;

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
