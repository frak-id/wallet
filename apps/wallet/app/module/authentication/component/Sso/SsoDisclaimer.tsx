import { Text } from "@frak-labs/design-system/components/Text";
import { ExternalLink } from "@frak-labs/wallet-shared";
import { Trans } from "react-i18next";
import * as styles from "@/module/authentication/component/Sso/index.css";
import type { Metadata } from "@/module/authentication/component/Sso/types";

/**
 * Simplified SSO disclaimer with links to the terms and privacy pages.
 */
export function SsoDisclaimer({ metadata }: { metadata: Metadata }) {
    return (
        <Text variant="caption" align="center" color="primary">
            <Trans
                i18nKey={"authent.sso.description"}
                values={{
                    productName: metadata.name,
                }}
                components={{
                    conditionsLink: (
                        <ExternalLink
                            href="https://frak.id/terms"
                            className={styles.disclaimerLink}
                        />
                    ),
                    privacyLink: (
                        <ExternalLink
                            href="https://frak.id/privacy"
                            className={styles.disclaimerLink}
                        />
                    ),
                }}
            />
        </Text>
    );
}
