import { Text } from "@frak-labs/design-system/components/Text";
import { ExternalLink } from "@frak-labs/wallet-shared";
import { Trans } from "react-i18next";
import * as styles from "./index.css";

export function TermsDisclosure() {
    return (
        <Text as="p" variant="caption" color="primary" align="center">
            <Trans
                i18nKey="wallet.referral.create.terms"
                components={{
                    termsLink: (
                        <ExternalLink
                            href="https://frak.id/terms"
                            className={styles.link}
                        />
                    ),
                }}
            />
        </Text>
    );
}
