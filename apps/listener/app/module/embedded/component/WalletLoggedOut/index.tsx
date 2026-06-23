import { Markdown } from "@frak-labs/wallet-shared/common";
import { clsx as cx } from "clsx";
import { prefixWalletCss } from "@/module/common/utils/prefixWalletCss";
import { SsoButton } from "@/module/component/SsoButton";
import { AuthenticateWithPhone } from "@/module/modal/component/AuthenticateWithPhone";
import { useSafeResolvingContext } from "@/module/stores/hooks";
import {
    useEmbeddedListenerUI,
    useListenerTranslation,
} from "@/ui/ListenerUiProvider";
import * as styles from "./index.css";

/**
 * View for the logged out user
 * @constructor
 */
export function LoggedOutComponent() {
    const {
        currentRequest: { logoUrl, homepageLink },
    } = useEmbeddedListenerUI();
    const { t } = useListenerTranslation();
    const merchantId = useSafeResolvingContext()?.merchantId;

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
            {merchantId && (
                <>
                    <SsoButton
                        merchantId={merchantId as `0x${string}`}
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
