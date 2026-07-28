import { Box } from "@frak-labs/design-system/components/Box";
import { LogoFrak } from "@frak-labs/design-system/icons";
import { mediaSrcSet } from "@frak-labs/wallet-shared/common/utils/mediaSrcSet";
import * as layout from "@/module/authentication/component/authLayout.css";
import * as styles from "@/module/authentication/component/Sso/index.css";
import type { Metadata } from "@/module/authentication/component/Sso/types";

/**
 * Circular merchant logo used as the hero icon.
 * Falls back to the flat-blue Frak mark when no merchant logo is provided.
 */
export function MerchantIcon({ metadata }: { metadata: Metadata }) {
    if (metadata.logoUrl) {
        return (
            <Box className={layout.heroIcon}>
                <img
                    {...mediaSrcSet(metadata.logoUrl)}
                    alt={metadata.name ?? ""}
                    className={styles.merchantImg}
                />
            </Box>
        );
    }
    return (
        <Box className={layout.heroIcon}>
            <LogoFrak width={48} height={48} />
        </Box>
    );
}
