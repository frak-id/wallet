import { getIFrameResolvingContext } from "@/context/sdk/utils/iframeContext";
import { emitLifecycleEvent } from "@/context/sdk/utils/lifecycleEvents";
import { sessionAtom } from "@/module/common/atoms/session";
import { Markdown } from "@/module/common/component/Markdown";
import { SsoButton } from "@/module/listener/component/SsoButton";
import { ButtonWallet } from "@/module/listener/embeded/component/ButtonWallet";
import { useListenerTranslation } from "@/module/listener/providers/ListenerUiProvider";
import { useGetUserBalance } from "@/module/tokens/hook/useGetUserBalance";
import type { DisplayEmbededWalletParamsType } from "@frak-labs/core-sdk";
import { Copy } from "@module/asset/icons/Copy";
import { LogoFrakWithName } from "@module/asset/icons/LogoFrakWithName";
import { Power } from "@module/asset/icons/Power";
import { Share } from "@module/asset/icons/Share";
import { jotaiStore } from "@module/atoms/store";
import { Overlay } from "@module/component/Overlay";
import { prefixWalletCss } from "@module/utils/prefixWalletCss";
import { cx } from "class-variance-authority";
import { useCallback, useEffect } from "react";
import styles from "./index.module.css";

type CommonProps = {
    params: DisplayEmbededWalletParamsType;
    appName: string;
};

export function ListenerWallet(props: CommonProps) {
    /**
     * Display the iframe
     */
    useEffect(() => {
        emitLifecycleEvent({
            iframeLifecycle: "show",
        });
    }, []);

    /**
     * Method to close the modal
     */
    const onClose = useCallback(() => {
        emitLifecycleEvent({ iframeLifecycle: "hide" });
    }, []);

    return (
        <>
            <div className={styles.modalListenerWallet}>
                <CurrentEmbeddedViewComponent {...props} />
            </div>
            <Overlay
                onOpenChange={(value) => {
                    !value && onClose();
                }}
            />
        </>
    );
}

/**
 * Return the right inner component depending on the current session
 * @constructor
 */
function CurrentEmbeddedViewComponent(props: CommonProps) {
    const session = jotaiStore.get(sessionAtom);

    return (
        <div
            className={cx(
                styles.modalListenerWallet__inner,
                session && styles["modalListenerWallet__inner--loggedIn"]
            )}
        >
            <ListenerWalletHeader {...props} />
            {session ? (
                <LoggedInComponent />
            ) : (
                <LoggedOutComponent {...props} />
            )}
        </div>
    );
}

/**
 * Header of the wallet
 * @constructor
 */
export function ListenerWalletHeader({ params }: CommonProps) {
    const { metadata } = params;

    return (
        <div className={styles.modalListenerWallet__header}>
            <LogoFrakWithName
                width={63}
                height={22}
                className={styles.modalListenerWallet__logoFrak}
            />
            {metadata?.logo && (
                <h1>
                    <img
                        src={metadata.logo}
                        className={styles.modalListenerWallet__logo}
                        alt=""
                    />
                </h1>
            )}
        </div>
    );
}

/**
 * View for the logged in user
 * @constructor
 */
function LoggedInComponent() {
    return (
        <>
            <Balance />
            <ActionButtons />
        </>
    );
}

function Balance() {
    const { t } = useListenerTranslation();
    const { userBalance } = useGetUserBalance();

    return (
        <div className={styles.balance}>
            <h2 className={styles.balance__title}>
                {t("common.balance")}{" "}
                <span className={styles.balance__status}>(pending)</span>
            </h2>
            <p className={styles.balance__amount}>
                {userBalance?.eurBalance?.toFixed(2) ?? 0}€
            </p>
        </div>
    );
}

function ActionButtons() {
    return (
        <div className={styles.modalListenerWallet__actionButtons}>
            <ButtonWallet variant={"danger"} icon={<Power />}>
                Disabled
            </ButtonWallet>
            <ButtonWallet icon={<Copy />}>Copy link</ButtonWallet>
            <ButtonWallet disabled icon={<Share />}>
                Share
            </ButtonWallet>
        </div>
    );
}

/**
 * View for the logged out user
 * @constructor
 */
function LoggedOutComponent({ params, appName }: CommonProps) {
    const { metadata, loggedOut } = params;
    const { t } = useListenerTranslation();
    const productId = getIFrameResolvingContext()?.productId;

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
                    appName={appName}
                    productId={productId}
                    ssoMetadata={{
                        logoUrl: metadata?.logo,
                        homepageLink: metadata?.homepageLink,
                    }}
                    lang={metadata?.lang}
                    text={loggedOut?.metadata?.buttonText}
                    defaultText={t("sdk.wallet.login.default.primaryAction")}
                    className={`${styles.modalListenerWallet__buttonPrimary} ${prefixWalletCss("button-primary")}`}
                />
            )}
        </>
    );
}
