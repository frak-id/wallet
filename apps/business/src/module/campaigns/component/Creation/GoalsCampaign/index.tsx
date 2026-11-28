import { Card } from "@frak-labs/design-system/components/Card";
import { FieldError } from "@frak-labs/design-system/components/FieldError";
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
    RefreshIcon,
} from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import {
    applyGoalTrigger,
    type CampaignDraft,
    campaignStore,
} from "@/stores/campaignStore";
import { shouldShowError } from "../fieldError";
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
        id: "subscription",
        icon: <RefreshIcon width={24} height={24} />,
        titleKey: "campaigns.create.goals.options.subscription.title",
        descKey: "campaigns.create.goals.options.subscription.description",
        tagsKey: "campaigns.create.goals.options.subscription.tags",
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

function GoalOption({
    goal,
    locked,
}: {
    goal: (typeof GOALS)[number];
    locked: boolean;
}) {
    const { t } = useTranslation();
    const hintId = `goal-${goal.id}-hint`;
    const dimmed = locked ? styles.dimmed : undefined;
    return (
        <label
            htmlFor={`goal-${goal.id}`}
            className={
                locked ? `${styles.row} ${styles.rowLocked}` : styles.row
            }
        >
            <span className={styles.left}>
                <RadioGroupItem
                    id={`goal-${goal.id}`}
                    value={goal.id}
                    size="l"
                    disabled={locked}
                    aria-describedby={locked ? hintId : undefined}
                />
                <span className={clsx(styles.badge, dimmed)}>{goal.icon}</span>
            </span>
            <span className={styles.main}>
                <Text variant="body" weight="medium" className={dimmed}>
                    {t(goal.titleKey)}
                </Text>
                <span className={clsx(styles.textGroup, dimmed)}>
                    <Text variant="bodySmall" color="secondary">
                        {t(goal.descKey)}
                    </Text>
                    <Text variant="bodySmall" color="tertiary">
                        {t(goal.tagsKey)}
                    </Text>
                </span>
                {locked && (
                    <Text id={hintId} variant="bodySmall" color="action">
                        {t(
                            "campaigns.create.goals.options.subscription.notConnected"
                        )}
                    </Text>
                )}
            </span>
        </label>
    );
}

export function GoalsCampaign() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const draft = campaignStore((s) => s.draft);
    const saveCampaign = useSaveCampaign();
    const { data: merchant } = useMerchant({ merchantId });
    // Subscription orders are only resolved through a connected provider.
    const subscriptionLocked =
        merchant !== undefined &&
        !merchant.subscriptionProvider &&
        draft.metadata.goal !== "subscription";

    const form = useForm<CampaignDraft>({
        values: useMemo(() => ({ ...draft, merchantId }), [draft, merchantId]),
        mode: "onChange",
    });

    // The goal picks the trigger, and the trigger decides which later steps
    // and reward models exist — so it's resolved here, on save.
    const withTrigger = (values: CampaignDraft) =>
        applyGoalTrigger({ ...values, merchantId }, values.metadata.goal);

    async function onSubmit(values: CampaignDraft) {
        const saved = await saveCampaign.mutateAsync(withTrigger(values));
        navigate({
            to: "/m/$merchantId/campaigns/draft/$campaignId/territory",
            params: { merchantId, campaignId: saved.id },
        });
    }

    const handleSaveDraft = form.handleSubmit(async (values: CampaignDraft) => {
        await saveCampaign.mutateAsync(withTrigger(values));
    });

    return (
        <WizardStep
            stepKey="goals"
            formId={FORM_ID}
            isValid={form.formState.isValid}
            isPending={saveCampaign.isPending}
            onSaveDraft={handleSaveDraft}
            onClose={() => form.reset(draft)}
            hasUnsavedChanges={form.formState.isDirty}
        >
            <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
                <Card radius="m">
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
                            render={({ field, fieldState }) => {
                                const showError = shouldShowError(fieldState);
                                return (
                                    <>
                                        <RadioGroup
                                            className={styles.list}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            {GOALS.map((goal) => (
                                                <GoalOption
                                                    key={goal.id}
                                                    goal={goal}
                                                    locked={
                                                        goal.id ===
                                                            "subscription" &&
                                                        subscriptionLocked
                                                    }
                                                />
                                            ))}
                                        </RadioGroup>
                                        <FieldError>
                                            {showError
                                                ? fieldState.error?.message
                                                : null}
                                        </FieldError>
                                    </>
                                );
                            }}
                        />
                    </Stack>
                </Card>
            </form>
        </WizardStep>
    );
}
