import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { LogoFrakWithName } from "@frak-labs/design-system/icons";
import { MerchantLogo } from "../MerchantLogo";
import * as styles from "./sharingPage.css";
import type { SharingMerchant, SharingT } from "./types";

/**
 * Merchant + Frak lockup and the "Later" dismiss.
 *
 * Never rendered chromeless: a host presenting this page in its own sheet
 * already draws a header and a close affordance, and stacking two of each
 * reads as a bug.
 */
export function PageHeader({
    merchant,
    t,
    onDismiss,
}: {
    merchant: SharingMerchant;
    t: SharingT;
    onDismiss: () => void;
}) {
    return (
        <header className={styles.header}>
            <Box display="flex" alignItems="center" gap="m">
                <MerchantLogo
                    src={merchant.logoUrl}
                    alt={merchant.name}
                    className={styles.merchantLogo}
                />
                <LogoFrakWithName className={styles.logo} />
            </Box>
            <Button
                variant="ghost"
                size="none"
                width="auto"
                className={styles.dismissButton}
                onClick={onDismiss}
            >
                {t("sdk.sharingPage.dismiss")}
            </Button>
        </header>
    );
}
