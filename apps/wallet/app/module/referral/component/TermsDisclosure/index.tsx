import { Text } from "@frak-labs/design-system/components/Text";
import { Trans } from "react-i18next";
import * as styles from "./index.css";

export function TermsDisclosure() {
    return (
        <Text as="p" variant="caption" color="primary" align="center">
            <Trans
                i18nKey="wallet.referral.create.terms"
                components={{
                    termsLink: (
                        // biome-ignore lint/a11y/useAnchorContent: Content provided by Trans i18n component
                        <a
                            href="https://frak.id/terms"
                            target="_blank"
                            rel="noreferrer"
                            className={styles.link}
                        />
                    ),
                }}
            />
        </Text>
    );
}
