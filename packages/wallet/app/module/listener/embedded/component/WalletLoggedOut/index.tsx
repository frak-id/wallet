import { Markdown } from "@/module/common/component/Markdown";
import { useSafeResolvingContext } from "@/module/listener/atoms/resolvingContext";
import { SsoButton } from "@/module/listener/component/SsoButton";
import { AuthenticateWithPhone } from "@/module/listener/modal/component/AuthenticateWithPhone";
import {
    useEmbeddedListenerUI,
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
    } = useEmbeddedListenerUI();
    const { t } = useListenerTranslation();
    const productId = useSafeResolvingContext()?.productId;

    return (
        <>
            <div className={styles.modalListenerWallet__text}>
                <Markdown md={t("sdk.wallet.login.text")} />
            </div>
            {productId && (
                <>
                    <SsoButton
                        productId={productId}
                        ssoMetadata={{
                            logoUrl,
                            homepageLink,
                        }}
                        text={t("sdk.wallet.login.primaryAction")}
                        className={`${styles.modalListenerWallet__buttonPrimary} ${prefixWalletCss("button-primary")}`}
                    />
                    <AuthenticateWithPhone
                        text={t("sdk.modal.login.secondaryAction")}
                        className={`${styles.modalListenerWallet__buttonPrimary} ${prefixWalletCss("button-primary")}`}
                    />
                </>
            )}
        </>
    );
}
