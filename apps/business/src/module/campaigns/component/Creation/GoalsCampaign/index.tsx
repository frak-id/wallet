import { Card } from "@frak-labs/design-system/components/Card";
import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    BarChartIcon,
    CartIcon,
    CommunityIcon,
} from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { type CampaignDraft, campaignStore } from "@/stores/campaignStore";
import { InfoBanner } from "../InfoBanner";
import { WizardStep } from "../WizardStep";
import * as styles from "./goalsCampaign.css";

const FORM_ID = "campaign-goals-form";

/** Goal options shown as radio cards. i18n keys are literals for the typed `t()`. */
const GOALS = [
    {
        id: "sales",
        icon: <CartIcon width={24} height={24} />,
        titleKey: "campaigns.create.goals.options.sales.title",
        descKey: "campaigns.create.goals.options.sales.description",
        tagsKey: "campaigns.create.goals.options.sales.tags",
    },
    {
        id: "traffic",
        icon: <CommunityIcon width={24} height={24} />,
        titleKey: "campaigns.create.goals.options.traffic.title",
        descKey: "campaigns.create.goals.options.traffic.description",
        tagsKey: "campaigns.create.goals.options.traffic.tags",
    },
    {
        id: "registration",
        icon: <BarChartIcon width={24} height={24} />,
        titleKey: "campaigns.create.goals.options.registration.title",
        descKey: "campaigns.create.goals.options.registration.description",
        tagsKey: "campaigns.create.goals.options.registration.tags",
    },
] as const;

export function GoalsCampaign() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const draft = campaignStore((s) => s.draft);
    const saveCampaign = useSaveCampaign();

    const form = useForm<CampaignDraft>({
        values: useMemo(() => ({ ...draft, merchantId }), [draft, merchantId]),
        mode: "onChange",
    });

    async function onSubmit(values: CampaignDraft) {
        const saved = await saveCampaign.mutateAsync({ ...values, merchantId });
        navigate({
            to: "/m/$merchantId/campaigns/draft/$campaignId/metrics",
            params: { merchantId, campaignId: saved.id },
        });
    }

    const handleSaveDraft = form.handleSubmit(async (values: CampaignDraft) => {
        await saveCampaign.mutateAsync({ ...values, merchantId });
    });

    return (
        <WizardStep
            stepKey="goals"
            formId={FORM_ID}
            isValid={form.formState.isValid}
            isPending={saveCampaign.isPending}
            onSaveDraft={handleSaveDraft}
            onClose={() => form.reset(draft)}
        >
            <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <Stack space="m">
                        <InfoBanner>
                            {t("campaigns.create.goals.info")}
                        </InfoBanner>
                        <Controller
                            control={form.control}
                            name="metadata.goal"
                            rules={{
                                required: t("campaigns.create.goals.required"),
                            }}
                            render={({ field }) => (
                                <RadioGroup
                                    className={styles.list}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                >
                                    {GOALS.map((goal) => (
                                        <label
                                            key={goal.id}
                                            htmlFor={`goal-${goal.id}`}
                                            className={styles.row}
                                        >
                                            <span className={styles.left}>
                                                <RadioGroupItem
                                                    id={`goal-${goal.id}`}
                                                    value={goal.id}
                                                />
                                                <span className={styles.badge}>
                                                    {goal.icon}
                                                </span>
                                            </span>
                                            <span className={styles.main}>
                                                <Text
                                                    variant="body"
                                                    weight="medium"
                                                >
                                                    {t(goal.titleKey)}
                                                </Text>
                                                <span
                                                    className={styles.textGroup}
                                                >
                                                    <Text
                                                        variant="bodySmall"
                                                        color="secondary"
                                                    >
                                                        {t(goal.descKey)}
                                                    </Text>
                                                    <Text
                                                        variant="bodySmall"
                                                        color="tertiary"
                                                    >
                                                        {t(goal.tagsKey)}
                                                    </Text>
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </RadioGroup>
                            )}
                        />
                    </Stack>
                </Card>
            </form>
        </WizardStep>
    );
}
