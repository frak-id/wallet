import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    DocumentIcon,
    EyeIcon,
    HelpChatIcon,
    StarIcon,
} from "@frak-labs/design-system/icons";
import type { ComponentType, SVGProps } from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type ExternalRow = {
    href: string;
    icon: IconComponent;
    labelKey: string;
    fallback: string;
};

function LinkRow({ row }: { row: ExternalRow }) {
    const { t } = useTranslation();
    const Icon = row.icon;

    return (
        <Box
            as="a"
            href={row.href}
            target={row.href.startsWith("mailto:") ? undefined : "_blank"}
            rel={row.href.startsWith("mailto:") ? undefined : "noreferrer"}
            className={styles.row}
        >
            <Box className={styles.rowContent}>
                <Icon width={24} height={24} className={styles.icon} />
                <Box className={styles.textGroup}>
                    <Text as="span" variant="body" weight="medium">
                        {t(row.labelKey, row.fallback)}
                    </Text>
                </Box>
            </Box>
        </Box>
    );
}

export function ProfileLinksCard() {
    return (
        <>
            <Card padding="none" className={styles.card}>
                <LinkRow
                    row={{
                        href: "https://frak.id/privacy",
                        icon: EyeIcon,
                        labelKey: "wallet.profile.privacyPolicy",
                        fallback: "Privacy policy",
                    }}
                />
                <LinkRow
                    row={{
                        href: "https://frak.id/privacy",
                        icon: DocumentIcon,
                        labelKey: "wallet.settings.termsOfUse",
                        fallback: "Terms of Use",
                    }}
                />
            </Card>
            <Card padding="none" className={styles.card}>
                <LinkRow
                    row={{
                        href: "mailto:hello@frak.id",
                        icon: HelpChatIcon,
                        labelKey: "wallet.profile.helpSupport",
                        fallback: "Help & support",
                    }}
                />
            </Card>
            <Card padding="none" className={styles.card}>
                <LinkRow
                    row={{
                        href: "https://frak.id/rate",
                        icon: StarIcon,
                        labelKey: "wallet.profile.rateApp",
                        fallback: "Rate the app",
                    }}
                />
            </Card>
        </>
    );
}
