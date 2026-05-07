import { Stack } from "@frak-labs/design-system/components/Stack";
import { ExternalLink } from "@frak-labs/wallet-shared";
import { ExternalLink as ExternalLinkIcon, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

export function LegalLinks() {
    const { t } = useTranslation();

    return (
        <Panel size={"small"}>
            <Title icon={<Scale size={32} />}>
                {t("wallet.settings.legal")}
            </Title>
            <Stack space="m">
                <ExternalLink
                    href="https://frak.id/privacy"
                    className={styles.legalLink}
                >
                    {t("wallet.settings.termsOfUse")}
                    <ExternalLinkIcon size={16} />
                </ExternalLink>
                <ExternalLink
                    href="https://frak.id/account-deletion"
                    className={styles.legalLink}
                >
                    {t("wallet.settings.deleteAccount")}
                    <ExternalLinkIcon size={16} />
                </ExternalLink>
            </Stack>
        </Panel>
    );
}
