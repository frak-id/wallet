import { Stack } from "@frak-labs/design-system/components/Stack";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useCampaignCurrencyGlyph } from "@/module/campaigns/hook/useCampaignCurrencyGlyph";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { campaignStore, isPurchaseCampaign } from "@/stores/campaignStore";
import { InfoBanner } from "../InfoBanner";
import { WizardFieldCard } from "../WizardFieldCard";
import { WizardStep } from "../WizardStep";
import { CampaignTypeField } from "./CampaignTypeField";
import { CurrencyGlyphContext } from "./currencyGlyph";
import { EligibilityField } from "./EligibilityField";
import { LockupField } from "./LockupField";
import { ModelField } from "./ModelField";
import { RewardBasisField } from "./RewardBasisField";
import {
    DEFAULT_REWARD_FORM,
    draftToRewardForm,
    isRewardFormValid,
    type RewardFormValues,
    requiresMatchedBasis,
    rewardFormToDraft,
    supportsMatchedBasis,
} from "./utils";

const FORM_ID = "campaign-reward-form";

export function RewardCampaign() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const rule = campaignStore((s) => s.draft.rule);
    const updateDraft = campaignStore((s) => s.updateDraft);
    const saveCampaign = useSaveCampaign();
    const currencyGlyph = useCampaignCurrencyGlyph();

    // Off a purchase there is no basket to compute on, so the fixed model is
    // the only one that can pay out — preselect it and lock the choice.
    const isPurchase = isPurchaseCampaign(rule);

    const defaultValues = useMemo(() => {
        const values = draftToRewardForm({ rule });
        return isPurchase ? values : { ...values, model: "fixed" as const };
    }, [rule, isPurchase]);

    const form = useForm<RewardFormValues>({
        values: defaultValues,
        mode: "onChange",
    });

    const model = useWatch({ control: form.control, name: "model" });

    // A scoped campaign can pay on the matched items; a negated scope must.
    const isScoped = supportsMatchedBasis({ rule });
    const basisLocked = requiresMatchedBasis({ rule });

    const watched = useWatch({ control: form.control });
    const isValid = isRewardFormValid(
        {
            ...DEFAULT_REWARD_FORM,
            ...watched,
        } as RewardFormValues,
        { requiresMatchedBasis: basisLocked }
    );

    async function persist(values: RewardFormValues) {
        const { draft } = campaignStore.getState();
        const updated = rewardFormToDraft(values, { ...draft, merchantId });
        updateDraft(() => updated);
        return saveCampaign.mutateAsync(updated);
    }

    async function onSubmit(values: RewardFormValues) {
        const saved = await persist(values);
        navigate({
            to: "/m/$merchantId/campaigns/draft/$campaignId/referral-chain",
            params: { merchantId, campaignId: saved.id },
        });
    }

    const handleSaveDraft = form.handleSubmit(persist);

    return (
        <CurrencyGlyphContext.Provider value={currencyGlyph}>
            <WizardStep
                stepKey="reward"
                formId={FORM_ID}
                isValid={isValid}
                isPending={saveCampaign.isPending}
                onSaveDraft={handleSaveDraft}
                onClose={() => form.reset(defaultValues)}
                hasUnsavedChanges={form.formState.isDirty}
            >
                <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
                    <Stack space="l">
                        {saveCampaign.isError && (
                            <InfoBanner tone="error">
                                {t("campaigns.create.reward.saveError")}
                            </InfoBanner>
                        )}
                        <WizardFieldCard
                            space="xs"
                            label={t(
                                "campaigns.create.reward.campaignType.label"
                            )}
                            description={t(
                                "campaigns.create.reward.campaignType.description"
                            )}
                        >
                            <CampaignTypeField control={form.control} />
                        </WizardFieldCard>

                        <WizardFieldCard
                            space="xs"
                            label={t("campaigns.create.reward.model.label")}
                            description={t(
                                "campaigns.create.reward.model.description"
                            )}
                        >
                            <ModelField
                                control={form.control}
                                setValue={form.setValue}
                                model={model}
                                isPurchase={isPurchase}
                            />
                        </WizardFieldCard>

                        {isScoped && model && model !== "fixed" && (
                            <WizardFieldCard
                                space="xs"
                                label={t("campaigns.create.reward.basis.label")}
                                description={t(
                                    "campaigns.create.reward.basis.description"
                                )}
                            >
                                <RewardBasisField
                                    control={form.control}
                                    locked={basisLocked}
                                />
                            </WizardFieldCard>
                        )}

                        {basisLocked && model === "fixed" && (
                            <InfoBanner tone="error">
                                {t(
                                    "campaigns.create.reward.basis.fixedNotAllowed"
                                )}
                            </InfoBanner>
                        )}

                        {/* Minimum purchase and lockup both describe a
                            purchase; neither has a meaning off that trigger. */}
                        {isPurchase && model !== "tiered" && (
                            <WizardFieldCard
                                space="xs"
                                label={t(
                                    "campaigns.create.reward.eligibility.label"
                                )}
                                description={t(
                                    "campaigns.create.reward.eligibility.description"
                                )}
                            >
                                <EligibilityField control={form.control} />
                            </WizardFieldCard>
                        )}

                        {isPurchase && (
                            <WizardFieldCard
                                space="xs"
                                label={t(
                                    "campaigns.create.reward.lockup.label"
                                )}
                                description={t(
                                    "campaigns.create.reward.lockup.description"
                                )}
                            >
                                <LockupField control={form.control} />
                            </WizardFieldCard>
                        )}
                    </Stack>
                </form>
            </WizardStep>
        </CurrencyGlyphContext.Provider>
    );
}
