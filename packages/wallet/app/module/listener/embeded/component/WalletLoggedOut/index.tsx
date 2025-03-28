import { Markdown } from "@/module/common/component/Markdown";
import { useSafeResolvingContext } from "@/module/listener/atoms/resolvingContext";
import { SsoButton } from "@/module/listener/component/SsoButton";
import {
    useEmbededListenerUI,
    useListenerTranslation,
} from "@/module/listener/providers/ListenerUiProvider";
import { prefixWalletCss } from "@shared/module/utils/prefixWalletCss";
import styles from "./index.module.css";

/**
 * View for the logged out user
 * @constructor
 */
export function LoggedOutComponent() {
    const {
        currentRequest: { logoUrl, homepageLink },
    } = useEmbededListenerUI();
    const { t } = useListenerTranslation();
    const productId = useSafeResolvingContext()?.productId;

    return (
        <>
            <div className={styles.modalListenerWallet__text}>
                <Markdown md={t("sdk.wallet.login.text")} />
            </div>
            {productId && (
                <SsoButton
                    productId={productId}
                    ssoMetadata={{
                        logoUrl,
                        homepageLink,
                    }}
                    text={t("sdk.wallet.login.primaryAction")}
                    className={`${styles.modalListenerWallet__buttonPrimary} ${prefixWalletCss("button-primary")}`}
                />
            )}
        </>
    );
}
