import { prefixWalletCss } from "@frak-labs/ui/utils/prefixWalletCss";
import { cx } from "class-variance-authority";
import { Markdown } from "@/module/common/component/Markdown";
import { useSafeResolvingContext } from "@/module/listener/atoms/resolvingContext";
import { SsoButton } from "@/module/listener/component/SsoButton";
import { AuthenticateWithPhone } from "@/module/listener/modal/component/AuthenticateWithPhone";
import {
    useEmbeddedListenerUI,
    useListenerTranslation,
} from "@/module/listener/providers/ListenerUiProvider";
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
