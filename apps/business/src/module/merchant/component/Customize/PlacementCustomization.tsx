import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Panel } from "@/module/common/component/Panel";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { FormActions } from "@/module/forms/FormActions";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { BannerFields, getBannerDefaults } from "./fields/BannerFields";
import { ButtonShareFields } from "./fields/ButtonShareFields";
import {
    getPostPurchaseDefaults,
    PostPurchaseFields,
} from "./fields/PostPurchaseFields";
import styles from "./index.module.css";
import {
    DeletePlacementPanel,
    PlacementCssPanel,
    PlacementTranslationsPanel,
} from "./PlacementPanels";
import { COMPONENT_LABELS } from "./translations";
import type { ComponentType, PlacementSettingsFormValues } from "./types";
import { updatePlacement, valueOrUndefined } from "./utils";

export function PlacementCustomization({
    merchantId,
    placementId,
    sdkConfig,
    onDirtyChange,
    onSelectDefaultTab,
}: {
    merchantId: string;
    placementId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
    onSelectDefaultTab: () => void;
}) {
    const placement = sdkConfig.placements?.[placementId];

    if (!placement) return null;

    return (
        <>
            <PlacementSettingsPanel
                merchantId={merchantId}
                placementId={placementId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />
            <PlacementCssPanel
                merchantId={merchantId}
                placementId={placementId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />
            <PlacementTranslationsPanel
                merchantId={merchantId}
                placementId={placementId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />
            <DeletePlacementPanel
                merchantId={merchantId}
                placementId={placementId}
                sdkConfig={sdkConfig}
                onDelete={onSelectDefaultTab}
            />
        </>
    );
}

const COMPONENT_TYPES: ComponentType[] = [
    "buttonShare",
    "postPurchase",
    "banner",
];

function getPlacementFormValues(
    sdkConfig: SdkConfig,
    placementId: string
): PlacementSettingsFormValues {
    const placement = sdkConfig.placements?.[placementId];
    const components = placement?.components;
    const bs = components?.buttonShare;
    return {
        targetInteraction: placement?.targetInteraction ?? "",
        buttonShare: {
            text: bs?.text ?? "",
            noRewardText: bs?.noRewardText ?? "",
            clickAction: bs?.clickAction ?? "sharing-page",
            useReward: bs?.useReward ?? false,
            css: bs?.rawCss ?? "",
        },
        postPurchase: getPostPurchaseDefaults(components),
        banner: getBannerDefaults(components),
    };
}

function PlacementSettingsPanel({
    merchantId,
    placementId,
    sdkConfig,
    onDirtyChange,
}: {
    merchantId: string;
    placementId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
}) {
    const {
        mutate: editSdkConfig,
        isPending,
        isSuccess,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });

    const [selectedComponent, setSelectedComponent] =
        useState<ComponentType>("buttonShare");

    const values = useMemo(
        () => getPlacementFormValues(sdkConfig, placementId),
        [sdkConfig.placements, placementId]
    );

    const form = useForm<PlacementSettingsFormValues>({
        values,
        defaultValues: {
            targetInteraction: "",
            buttonShare: {
                text: "",
                noRewardText: "",
                clickAction: "sharing-page",
                useReward: false,
                css: "",
            },
            postPurchase: {
                refereeText: "",
                refereeNoRewardText: "",
                referrerText: "",
                referrerNoRewardText: "",
                ctaText: "",
                ctaNoRewardText: "",
                css: "",
            },
            banner: {
                referralTitle: "",
                referralDescription: "",
                referralCta: "",
                inappTitle: "",
                inappDescription: "",
                inappCta: "",
                css: "",
            },
        },
    });

    useEffect(() => {
        onDirtyChange(
            `placement-${placementId}-settings`,
            form.formState.isDirty
        );
        return () => onDirtyChange(`placement-${placementId}-settings`, false);
    }, [form.formState.isDirty, onDirtyChange, placementId]);

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    const onSubmit = useCallback(
        (currentValues: PlacementSettingsFormValues) => {
            const buttonShare = {
                text: valueOrUndefined(currentValues.buttonShare.text),
                noRewardText: valueOrUndefined(
                    currentValues.buttonShare.noRewardText
                ),
                clickAction: currentValues.buttonShare.clickAction,
                useReward: currentValues.buttonShare.useReward,
                rawCss: valueOrUndefined(currentValues.buttonShare.css),
            };
            const postPurchase = {
                refereeText: valueOrUndefined(
                    currentValues.postPurchase.refereeText
                ),
                refereeNoRewardText: valueOrUndefined(
                    currentValues.postPurchase.refereeNoRewardText
                ),
                referrerText: valueOrUndefined(
                    currentValues.postPurchase.referrerText
                ),
                referrerNoRewardText: valueOrUndefined(
                    currentValues.postPurchase.referrerNoRewardText
                ),
                ctaText: valueOrUndefined(currentValues.postPurchase.ctaText),
                ctaNoRewardText: valueOrUndefined(
                    currentValues.postPurchase.ctaNoRewardText
                ),
                rawCss: valueOrUndefined(currentValues.postPurchase.css),
            };
            const banner = {
                referralTitle: valueOrUndefined(
                    currentValues.banner.referralTitle
                ),
                referralDescription: valueOrUndefined(
                    currentValues.banner.referralDescription
                ),
                referralCta: valueOrUndefined(currentValues.banner.referralCta),
                inappTitle: valueOrUndefined(currentValues.banner.inappTitle),
                inappDescription: valueOrUndefined(
                    currentValues.banner.inappDescription
                ),
                inappCta: valueOrUndefined(currentValues.banner.inappCta),
                rawCss: valueOrUndefined(currentValues.banner.css),
            };

            editSdkConfig({
                placements: updatePlacement(
                    sdkConfig,
                    placementId,
                    (placement) => ({
                        ...placement,
                        components: {
                            ...placement?.components,
                            buttonShare,
                            postPurchase,
                            banner,
                        },
                        targetInteraction: valueOrUndefined(
                            currentValues.targetInteraction
                        ),
                    })
                ),
            });
        },
        [editSdkConfig, sdkConfig, placementId]
    );

    return (
        <Form {...form}>
            <Panel title={`Placement settings · ${placementId}`}>
                <div className={styles.customize__settingsGrid}>
                    <FormField
                        control={form.control}
                        name="targetInteraction"
                        rules={{
                            maxLength: {
                                value: 200,
                                message: "Maximum length is 200 characters",
                            },
                        }}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel weight={"medium"}>
                                    Target interaction
                                </FormLabel>
                                <FormDescription>
                                    Event name that triggers reward calculation
                                    for this placement (e.g. purchase_completed,
                                    signup)
                                </FormDescription>
                                <FormControl>
                                    <Input
                                        length={"big"}
                                        maxLength={200}
                                        placeholder={"purchase_completed"}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className={styles.customize__componentSelector}>
                    {COMPONENT_TYPES.map((componentType) => (
                        <button
                            key={componentType}
                            type="button"
                            className={`${styles.customize__tab} ${
                                selectedComponent === componentType
                                    ? styles["customize__tab--active"]
                                    : ""
                            }`}
                            onClick={() => setSelectedComponent(componentType)}
                        >
                            {COMPONENT_LABELS[componentType]}
                        </button>
                    ))}
                </div>

                {selectedComponent === "buttonShare" && (
                    <ButtonShareFields form={form} />
                )}
                {selectedComponent === "postPurchase" && (
                    <PostPurchaseFields form={form} />
                )}
                {selectedComponent === "banner" && <BannerFields form={form} />}

                <FormActions
                    isSuccess={isSuccess}
                    isPending={isPending}
                    isDirty={form.formState.isDirty}
                    onDiscard={() => form.reset(values)}
                    onSubmit={() => form.handleSubmit(onSubmit)()}
                />
            </Panel>
        </Form>
    );
}
