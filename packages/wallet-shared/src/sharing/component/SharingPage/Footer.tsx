import { Button } from "@frak-labs/design-system/components/Button";
import { CopyIcon, ShareIcon } from "@frak-labs/design-system/icons";
import * as styles from "./sharingPage.css";
import type { SharingActions, SharingShareState, SharingT } from "./types";

/**
 * Share + copy CTAs. Kept even when a host owns the chrome: these are the
 * page's whole point and a share sheet has no equivalent for them.
 */
export function Footer({
    share,
    sharingLink,
    actions,
    t,
}: {
    share: SharingShareState;
    sharingLink: string | null;
    actions: Pick<SharingActions, "onShare" | "onCopy">;
    t: SharingT;
}) {
    return (
        <footer className={styles.footer}>
            {share.canShare && (
                <Button
                    variant="primary"
                    size="large"
                    fontSize="s"
                    onClick={actions.onShare}
                    disabled={share.isSharing || !sharingLink}
                    className={styles.shareButton}
                >
                    {t("sharing.btn.share")}
                    <ShareIcon width={16} height={16} />
                </Button>
            )}
            <Button
                variant="secondary"
                size="large"
                fontSize="s"
                onClick={actions.onCopy}
                disabled={!sharingLink}
                className={styles.copyButton}
            >
                {t("sharing.btn.copy")}
                <CopyIcon width={16} height={16} />
            </Button>
        </footer>
    );
}
