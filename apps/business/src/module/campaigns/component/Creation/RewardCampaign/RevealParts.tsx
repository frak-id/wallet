import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckFilledIcon, LightbulbIcon } from "@frak-labs/design-system/icons";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { campaignStore } from "@/stores/campaignStore";
import * as styles from "./reward.css";

export function RevealHeader() {
    const { t } = useTranslation();
    return (
        <Stack space="xxs">
            <Text variant="bodySmall" weight="medium" color="secondary">
                {t("campaigns.create.reward.value.label")}
            </Text>
            <Text variant="caption" color="tertiary">
                {t("campaigns.create.reward.value.description")}
            </Text>
        </Stack>
    );
}

/** The blue "Frak recommends 80/20" bar with an Apply-reco button. */
export function RecoBar({ onApply }: { onApply: () => void }) {
    const { t } = useTranslation();
    return (
        <div className={styles.recoBar}>
            <LightbulbIcon width={24} height={24} className={styles.recoIcon} />
            <Text
                variant="bodySmall"
                color="primary"
                className={styles.recoText}
            >
                <Trans
                    i18nKey="campaigns.create.reward.cpa.reco"
                    components={{
                        highlight: <span className={styles.recoHighlight} />,
                    }}
                />
            </Text>
            <Button
                type="button"
                variant="primary"
                size="small"
                onClick={onApply}
            >
                {t("campaigns.create.reward.cpa.applyReco")}
            </Button>
        </div>
    );
}

export function TriggeredRow() {
    const { t } = useTranslation();
    const trigger = campaignStore((s) => s.draft.rule.trigger);
    return (
        <Inline space="xs" alignY="center">
            <CheckFilledIcon
                width={12}
                height={12}
                className={styles.triggeredIcon}
            />
            <Text variant="caption" color="primary">
                {t("campaigns.create.reward.triggeredOn", {
                    trigger: t(`campaigns.create.reward.trigger.${trigger}`),
                })}
            </Text>
        </Inline>
    );
}
