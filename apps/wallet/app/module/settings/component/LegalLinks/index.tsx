import { Box } from "@frak-labs/ui/component/Box";
import { ExternalLink, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import styles from "./index.module.css";

export function LegalLinks() {
    const { t } = useTranslation();

    return (
        <Panel size={"small"}>
            <Title icon={<Scale size={32} />}>
                {t("wallet.settings.legal")}
            </Title>
            <Box as={"ul"} direction={"column"} gap={"ms"} padding={"none"}>
                <li>
                    <a
                        href="https://frak.id/privacy"
                        target={"_blank"}
                        rel={"noreferrer"}
                        className={styles.legalLinks__link}
                    >
                        {t("wallet.settings.termsOfUse")}
                        <ExternalLink size={16} />
                    </a>
                </li>
                <li>
                    <a
                        href="https://frak.id/account-deletion"
                        target={"_blank"}
                        rel={"noreferrer"}
                        className={styles.legalLinks__link}
                    >
                        {t("wallet.settings.deleteAccount")}
                        <ExternalLink size={16} />
                    </a>
                </li>
            </Box>
        </Panel>
    );
}
