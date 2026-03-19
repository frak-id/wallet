import { Stack } from "@frak-labs/design-system/components/Stack";
import { ExternalLink, Scale } from "lucide-react";
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
                <a
                    href="https://frak.id/privacy"
                    target={"_blank"}
                    rel={"noreferrer"}
                    className={styles.legalLink}
                >
                    {t("wallet.settings.termsOfUse")}
                    <ExternalLink size={16} />
                </a>
                <a
                    href="https://frak.id/account-deletion"
                    target={"_blank"}
                    rel={"noreferrer"}
                    className={styles.legalLink}
                >
                    {t("wallet.settings.deleteAccount")}
                    <ExternalLink size={16} />
                </a>
            </Stack>
        </Panel>
    );
}
