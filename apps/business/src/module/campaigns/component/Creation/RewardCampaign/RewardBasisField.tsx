import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InfoBanner } from "../InfoBanner";
import * as rows from "../wizardRows.css";
import type { RewardFormValues } from "./utils";

/**
 * Basis toggle for a product-scoped campaign: pay on the whole basket, or on
 * the scoped items only. Locked to "eligible products" when the scope is
 * negated — the backend requires it, so the choice isn't the merchant's.
 */
export function RewardBasisField({
    control,
    locked,
}: {
    control: Control<RewardFormValues>;
    locked: boolean;
}) {
    const { t } = useTranslation();
    return (
        <Stack space="m">
            {locked && (
                <InfoBanner>
                    {t("campaigns.create.reward.basis.lockedNote")}
                </InfoBanner>
            )}
            <Controller
                control={control}
                name="rewardBasis"
                render={({ field }) => (
                    <RadioGroup
                        value={locked ? "matchedItems" : field.value}
                        onValueChange={field.onChange}
                        disabled={locked}
                    >
                        {(["basket", "matchedItems"] as const).map((basis) => (
                            <label
                                key={basis}
                                htmlFor={`reward-basis-${basis}`}
                                className={rows.optionRow}
                            >
                                <RadioGroupItem
                                    id={`reward-basis-${basis}`}
                                    value={basis}
                                    size="l"
                                    disabled={locked}
                                />
                                <span className={rows.optionMain}>
                                    <Text variant="body" weight="medium">
                                        {t(
                                            `campaigns.create.reward.basis.${basis}.title`
                                        )}
                                    </Text>
                                    <Text variant="bodySmall" color="secondary">
                                        {t(
                                            `campaigns.create.reward.basis.${basis}.description`
                                        )}
                                    </Text>
                                </span>
                            </label>
                        ))}
                    </RadioGroup>
                )}
            />
        </Stack>
    );
}
