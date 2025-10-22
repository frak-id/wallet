import { prefixWalletCss } from "@frak-labs/ui/utils/prefixWalletCss";
import { Markdown } from "@frak-labs/wallet-shared/common/component/Markdown";
import { cx } from "class-variance-authority";
import { SsoButton } from "@/module/component/SsoButton";
import { AuthenticateWithPhone } from "@/module/modal/component/AuthenticateWithPhone";
import {
    useEmbeddedListenerUI,
    useListenerTranslation,
} from "@/module/providers/ListenerUiProvider";
import { useSafeResolvingContext } from "@/module/stores/hooks";
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
            <div
                className={cx(
                    styles.modalListenerWallet__text,
                    prefixWalletCss("modalListenerWallet__text")
                )}
            >
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
                        className={cx(
                            styles.modalListenerWallet__buttonPrimary,
                            prefixWalletCss("button-primary")
                        )}
                    />
                    <AuthenticateWithPhone
                        text={t("sdk.modal.login.secondaryAction")}
                        className={cx(
                            styles.modalListenerWallet__buttonPrimary,
                            prefixWalletCss("button-primary")
                        )}
                    />
                </>
            )}
        </>
    );
}
