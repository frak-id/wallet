import { Inline } from "@frak-labs/design-system/components/Inline";
import { NumberedCircle } from "@frak-labs/design-system/components/NumberedCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CloseIcon,
    HourglassIcon,
    LogoFrakWithName,
} from "@frak-labs/design-system/icons";
import { useState } from "react";
import { merchant } from "@/data/merchant";
import { campaign } from "@/data/rewards";
import { useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import type { InstallPageProps } from "@/surfaces/contracts";
import { MerchantLogo } from "../components/MerchantLogo";
import { RewardTicket } from "../components/RewardTicket";
import { walletMessages } from "../messages";
import { AppStoreSheet } from "./AppStoreSheet";
import * as styles from "./installPage.css";

function AppleLogo() {
    return (
        <svg width="12" height="14" viewBox="0 0 14 17" aria-hidden="true">
            <path
                fill="currentColor"
                d="M11.6 9c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.4 0-2.6.8-3.3 2.1-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.5 2.2 2.6 2.1 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.6 1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4 0 0-2.2-.8-2.2-3.4ZM9.6 3c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2Z"
            />
        </svg>
    );
}

function RewardCard() {
    const t = useT(walletMessages);
    const money = useFormatMoney();
    return (
        <RewardTicket
            label={t("install.reward.label", { merchant: merchant.name })}
            amount={money(campaign.referrerReward, "reward")}
            chip={{
                icon: <HourglassIcon width={12} height={12} />,
                label: t("install.reward.status"),
            }}
            detail={t("install.reward.detail")}
        />
    );
}

function HowItWorks() {
    const t = useT(walletMessages);
    const money = useFormatMoney();
    const reward = money(campaign.referrerReward, "reward");
    const steps = [
        t("install.steps.one"),
        t("install.steps.two"),
        t("install.steps.three", { amount: reward }),
    ];
    return (
        <Stack space="s">
            <Text variant="bodySmall" weight="medium" color="secondary">
                {t("install.steps.title")}
            </Text>
            {steps.map((label, index) => (
                <Inline key={label} space="s" alignY="center" wrap={false}>
                    <NumberedCircle number={index + 1} size="sm" />
                    <Text variant="bodySmall">{label}</Text>
                </Inline>
            ))}
        </Stack>
    );
}

/** `wallet.frak.id/install` for a web visitor who still needs the app. */
export function InstallPage(_props: InstallPageProps) {
    const t = useT(walletMessages);
    const money = useFormatMoney();
    const [storeOpen, setStoreOpen] = useState(false);

    return (
        <div className={styles.screen}>
            <div className={styles.container}>
                <header className={styles.header}>
                    <Inline space="m" alignY="center" wrap={false}>
                        <MerchantLogo size="header" />
                        <LogoFrakWithName className={styles.logo} />
                    </Inline>
                    <button
                        type="button"
                        className={styles.dismissButton}
                        aria-label={t("common.close")}
                    >
                        <CloseIcon width={24} height={24} />
                    </button>
                </header>

                <Stack as="main" space="l" padding="m" className={styles.main}>
                    <Stack as="section" space="xs" align="center">
                        <Text
                            as="h1"
                            variant="heading2"
                            className={styles.title}
                        >
                            {t("install.title", {
                                amount: money(
                                    campaign.referrerReward,
                                    "reward"
                                ),
                            })}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {t("install.description")}
                        </Text>
                    </Stack>
                    <RewardCard />
                    <HowItWorks />
                </Stack>

                <Stack as="footer" space="s" className={styles.footer}>
                    <button
                        type="button"
                        className={styles.downloadButton}
                        onClick={() => setStoreOpen(true)}
                    >
                        {t("install.download")}
                    </button>
                    <span className={styles.storeHint}>
                        <AppleLogo />
                        <Text as="span" variant="caption" color="secondary">
                            {t("install.storeHint")}
                        </Text>
                    </span>
                </Stack>
            </div>
            <AppStoreSheet open={storeOpen} />
        </div>
    );
}
