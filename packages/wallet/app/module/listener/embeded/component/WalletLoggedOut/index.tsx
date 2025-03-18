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
        currentRequest: {
            params: { metadata, loggedOut },
        },
    } = useEmbededListenerUI();
    const { fallbackT } = useListenerTranslation();
    const productId = useSafeResolvingContext()?.productId;

    return (
        <>
            <div className={styles.modalListenerWallet__text}>
                <Markdown
                    md={fallbackT(
                        loggedOut?.metadata?.text,
                        "sdk.wallet.login.default.text",
                        {
                            productName: metadata?.name,
                        }
                    )}
                />
            </div>
            {productId && (
                <SsoButton
                    productId={productId}
                    ssoMetadata={{
                        logoUrl: metadata?.logo,
                        homepageLink: metadata?.homepageLink,
                    }}
                    text={fallbackT(
                        loggedOut?.metadata?.buttonText,
                        "sdk.wallet.login.default.primaryAction"
                    )}
                    className={`${styles.modalListenerWallet__buttonPrimary} ${prefixWalletCss("button-primary")}`}
                />
            )}
        </>
    );
}
