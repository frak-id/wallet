import { Checkbox } from "@frak-labs/design-system/components/Checkbox";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { type Control, Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { type CampaignDraft, campaignStore } from "@/stores/campaignStore";
import type { SpecialCategory } from "@/types/Campaign";
import { WizardFieldCard } from "../WizardFieldCard";
import { WizardStep } from "../WizardStep";
import { CountrySelect } from "./CountrySelect";
import * as styles from "./territory.css";

const FORM_ID = "campaign-territory-form";

/** Special advertising categories. i18n keys are literals for the typed `t()`. */
const CATEGORIES = [
    {
        id: "credit",
        titleKey: "campaigns.create.territory.special.options.credit.title",
        descKey:
            "campaigns.create.territory.special.options.credit.description",
    },
    {
        id: "jobs",
        titleKey: "campaigns.create.territory.special.options.jobs.title",
        descKey: "campaigns.create.territory.special.options.jobs.description",
    },
    {
        id: "housing",
        titleKey: "campaigns.create.territory.special.options.housing.title",
        descKey:
            "campaigns.create.territory.special.options.housing.description",
    },
    {
        id: "social",
        titleKey: "campaigns.create.territory.special.options.social.title",
        descKey:
            "campaigns.create.territory.special.options.social.description",
    },
] as const satisfies ReadonlyArray<{
    id: SpecialCategory;
    titleKey: string;
    descKey: string;
}>;

/** A single special-advertising checkbox row. */
function CategoryRow({
    category,
    checked,
    onToggle,
}: {
    category: (typeof CATEGORIES)[number];
    checked: boolean;
    onToggle: () => void;
}) {
    const { t } = useTranslation();
    const id = `category-${category.id}`;
    return (
        <label htmlFor={id} className={styles.categoryRow}>
            <span className={styles.categorySelector}>
                <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={onToggle}
                />
            </span>
            <span className={styles.categoryMain}>
                <Text variant="body" weight="medium">
                    {t(category.titleKey)}
                </Text>
                <Text variant="bodySmall" color="secondary">
                    {t(category.descKey)}
                </Text>
            </span>
        </label>
    );
}

/** Country multi-select bound to `metadata.territories` (required). */
function TerritoryField({ control }: { control: Control<CampaignDraft> }) {
    const { t } = useTranslation();
    return (
        <Controller
            control={control}
            name="metadata.territories"
            rules={{
                validate: (v) =>
                    v && v.length > 0
                        ? true
                        : t("campaigns.create.territory.card.required"),
            }}
            render={({ field }) => (
                <CountrySelect
                    value={field.value ?? []}
                    onChange={field.onChange}
                />
            )}
        />
    );
}

/** Special-category checkboxes bound to `metadata.specialCategories`. */
function SpecialCategoriesField({
    control,
}: {
    control: Control<CampaignDraft>;
}) {
    const { t } = useTranslation();
    return (
        <Controller
            control={control}
            name="metadata.specialCategories"
            rules={{
                validate: (v) =>
                    !v || v.length === 0
                        ? true
                        : t("campaigns.create.territory.special.notSupported"),
            }}
            render={({ field }) => {
                const value = (field.value ?? []) as SpecialCategory[];
                const toggle = (id: SpecialCategory) =>
                    field.onChange(
                        value.includes(id)
                            ? value.filter((v) => v !== id)
                            : [...value, id]
                    );
                return (
                    <div className={styles.cells}>
                        {CATEGORIES.map((cat) => (
                            <CategoryRow
                                key={cat.id}
                                category={cat}
                                checked={value.includes(cat.id)}
                                onToggle={() => toggle(cat.id)}
                            />
                        ))}
                    </div>
                );
            }}
        />
    );
}

export function TerritoryCampaign() {
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
            to: "/m/$merchantId/campaigns/draft/$campaignId/budget",
            params: { merchantId, campaignId: saved.id },
        });
    }

    const handleSaveDraft = form.handleSubmit(async (values: CampaignDraft) => {
        await saveCampaign.mutateAsync({ ...values, merchantId });
    });

    return (
        <WizardStep
            stepKey="territory"
            formId={FORM_ID}
            isValid={form.formState.isValid}
            isPending={saveCampaign.isPending}
            onSaveDraft={handleSaveDraft}
            onClose={() => form.reset(draft)}
        >
            <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
                <Stack space="l">
                    <WizardFieldCard
                        label={t("campaigns.create.territory.card.label")}
                        description={t(
                            "campaigns.create.territory.card.description"
                        )}
                    >
                        <TerritoryField control={form.control} />
                    </WizardFieldCard>

                    <WizardFieldCard
                        space="xs"
                        label={t("campaigns.create.territory.special.label")}
                        description={t(
                            "campaigns.create.territory.special.description"
                        )}
                    >
                        <SpecialCategoriesField control={form.control} />
                    </WizardFieldCard>
                </Stack>
            </form>
        </WizardStep>
    );
}
