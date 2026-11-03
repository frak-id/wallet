import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CircleCheckIcon,
    FaceIdIcon,
    GiftIcon,
    LogoFrakBadge,
} from "@frak-labs/design-system/icons";
import { useDemoNav } from "@/core/store";
import { merchant } from "@/data/merchant";
import { personas } from "@/data/personas";
import { campaign } from "@/data/rewards";
import { useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import type { ExpressClaimProps } from "@/surfaces/contracts";
import { BottomSheet } from "../components/BottomSheet";
import { MerchantLogo } from "../components/MerchantLogo";
import { PasskeyPrompt, usePasskeyFlow } from "../components/PasskeyPrompt";
import { RewardTicket } from "../components/RewardTicket";
import { WalletReady } from "../components/WalletReady";
import { walletMessages } from "../messages";
import * as styles from "./expressClaim.css";

const CHECKS = [
    "claim.check.one",
    "claim.check.two",
    "claim.check.three",
] as const;

/** The referee's one-screen wallet creation, straight from the thank-you card. */
export function ExpressClaim({ persona }: ExpressClaimProps) {
    const t = useT(walletMessages);
    const money = useFormatMoney();
    const { next } = useDemoNav();
    const flow = usePasskeyFlow(next);
    const referrer = persona === "chloe" ? personas.lea : personas.chloe;

    return (
        <div className={styles.screen}>
            <div className={styles.body}>
                <Stack space="l" padding="m" className={styles.bodyContent}>
                    <Inline space="s" align="center" alignY="center">
                        <MerchantLogo size="small" />
                        <span className={styles.cross} aria-hidden="true">
                            ×
                        </span>
                        <LogoFrakBadge
                            width={40}
                            height={40}
                            className={styles.frakBadge}
                        />
                    </Inline>
                    <Stack space="xs" align="center">
                        <Text as="h1" variant="heading1" align="center">
                            {t("claim.title")}
                        </Text>
                        <Text color="secondary" align="center">
                            {t("claim.description")}
                        </Text>
                    </Stack>
                    <RewardTicket
                        label={t("install.reward.label", {
                            merchant: merchant.name,
                        })}
                        amount={money(campaign.refereeReward, "reward")}
                        chip={{
                            icon: <GiftIcon width={12} height={12} />,
                            label: t("history.welcomeBonus"),
                        }}
                        detail={t("claim.ticketDetail", {
                            referrer: referrer.firstName,
                        })}
                    />
                    <Stack space="s">
                        {CHECKS.map((key) => (
                            <Inline key={key} space="xs" alignY="center">
                                <CircleCheckIcon
                                    width={20}
                                    height={20}
                                    className={styles.checkIcon}
                                />
                                <Text variant="bodySmall">{t(key)}</Text>
                            </Inline>
                        ))}
                    </Stack>
                </Stack>
            </div>

            <Stack space="s" padding="m" className={styles.footer}>
                <Button
                    icon={<FaceIdIcon width={22} height={22} />}
                    loading={flow.stage !== "idle"}
                    onClick={flow.open}
                >
                    {t("claim.cta")}
                </Button>
                <Text variant="caption" color="secondary" align="center">
                    {t("claim.privacy")}
                </Text>
            </Stack>

            <BottomSheet
                open={flow.stage === "ready"}
                look="frak"
                label={t("passkey.ready")}
            >
                <WalletReady />
            </BottomSheet>
            <PasskeyPrompt
                persona={persona}
                stage={flow.stage}
                onContinue={flow.confirm}
            />
        </div>
    );
}
