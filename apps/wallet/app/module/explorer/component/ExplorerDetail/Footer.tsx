import { Button } from "@frak-labs/design-system/components/Button";
import { DetailSheetFooter } from "@frak-labs/design-system/components/DetailSheet";
import { CheckIcon, CoinsIcon, CopyIcon } from "@frak-labs/design-system/icons";
import { ua } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { useNativeBottomAction } from "@/module/native-glass/hook/useNativeBottomAction";
import { useNativeDetailChrome } from "@/module/native-glass/hook/useNativeDetailChrome";
import { useDetailSheetChromeVisible } from "@/module/native-glass/hook/useOverlayOpen";
import { AffiliateLinkCreateError } from "./AffiliateLinkCreateError";
import * as styles from "./index.css";

export type ExplorerDetailFooterProps = {
    /** Step 1: the per-user tracking link still has to be minted. */
    needsLink: boolean;
    creating: boolean;
    createDisabled: boolean;
    createError: boolean;
    onCreate: () => void;
    /** Step 2: share (or copy where sharing is unavailable) the ready link. */
    onShare: () => void;
    copied: boolean;
    onCopy: () => void;
};

/**
 * Explorer detail's primary "share and earn" CTA: a native prominent glass
 * button on iOS 26, the floating frosted web footer elsewhere.
 */
export function ExplorerDetailFooter(props: ExplorerDetailFooterProps) {
    const native = useNativeDetailChrome();
    return native ? <NativeFooter {...props} /> : <WebFooter {...props} />;
}

function WebFooter({
    needsLink,
    creating,
    createDisabled,
    createError,
    onCreate,
    onShare,
    copied,
    onCopy,
}: ExplorerDetailFooterProps) {
    const { t } = useTranslation();
    return (
        <DetailSheetFooter className={styles.floatingFooter}>
            <Button
                variant="primary"
                width="full"
                onClick={needsLink ? onCreate : onShare}
                disabled={needsLink && createDisabled}
                size="large"
                fontSize="s"
            >
                {t(primaryLabelKey(needsLink, creating))}
                <CoinsIcon width={16} height={16} />
            </Button>
            <AffiliateLinkCreateError
                show={createError}
                message={t("explorer.detail.createShareLinkError")}
            />
            {!ua.isMobile && !needsLink && (
                <Button
                    variant="ghost"
                    width="full"
                    onClick={onCopy}
                    size="large"
                    fontSize="s"
                >
                    {copied ? (
                        <CheckIcon width={16} height={16} />
                    ) : (
                        <CopyIcon width={16} height={16} />
                    )}
                    {t(copied ? "sharing.btn.copySuccess" : "sharing.btn.copy")}
                </Button>
            )}
        </DetailSheetFooter>
    );
}

function NativeFooter({
    needsLink,
    creating,
    createDisabled,
    createError,
    onCreate,
    onShare,
}: ExplorerDetailFooterProps) {
    const { t } = useTranslation();
    const visible = useDetailSheetChromeVisible("bottom");

    useNativeBottomAction({
        title: t(primaryLabelKey(needsLink, creating)),
        icon: "glass-coins",
        enabled: !(needsLink && createDisabled),
        loading: needsLink && creating,
        visible,
        // UIKit only learns of a disable one round trip later: a fast double tap
        // or a tap during the slide-out still arrives here.
        onPress: () => {
            if (!visible) return;
            if (!needsLink) onShare();
            else if (!createDisabled) onCreate();
        },
    });

    // The native button floats above the webview; only the error stays web.
    if (!createError) return null;
    return (
        <div className={styles.nativeFooterError}>
            <AffiliateLinkCreateError
                show={true}
                message={t("explorer.detail.createShareLinkError")}
            />
        </div>
    );
}

function primaryLabelKey(needsLink: boolean, creating: boolean) {
    if (!needsLink) return "explorer.detail.shareAndEarn" as const;
    return creating
        ? ("explorer.detail.creatingShareLink" as const)
        : ("explorer.detail.createShareLink" as const);
}
