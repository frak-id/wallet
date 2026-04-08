import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { Button } from "@frak-labs/ui/component/Button";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { AlertDialog } from "@/module/common/component/AlertDialog";
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
import { Switch } from "@/module/forms/Switch";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import styles from "./index.module.css";
import { LoginPreview } from "./ModalPreview";
import { CssEditor, TranslationEditor } from "./TranslationEditor";
import {
    buildTranslationsPayload,
    COMPONENT_LABELS,
    type ComponentType,
    type CssFormValues,
    getPlacementTranslationsFormValues,
    getTranslationsFormValues,
    type PlacementSettingsFormValues,
    type TranslationFormValues,
    type TranslationLang,
    updatePlacement,
    valueOrUndefined,
} from "./utils";

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
    "buttonWallet",
    "openInApp",
];

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

    const values = useMemo<PlacementSettingsFormValues>(() => {
        const placement = sdkConfig.placements?.[placementId];
        const components = placement?.components;
        return {
            targetInteraction: placement?.targetInteraction ?? "",
            buttonShare: {
                text: components?.buttonShare?.text ?? "",
                noRewardText: components?.buttonShare?.noRewardText ?? "",
                clickAction:
                    components?.buttonShare?.clickAction ?? "embedded-wallet",
                useReward: components?.buttonShare?.useReward ?? false,
                css: components?.buttonShare?.rawCss ?? "",
            },
            buttonWallet: {
                position: components?.buttonWallet?.position ?? "bottom-right",
                css: components?.buttonWallet?.rawCss ?? "",
            },
            openInApp: {
                text: components?.openInApp?.text ?? "",
                css: components?.openInApp?.rawCss ?? "",
            },
        };
    }, [sdkConfig.placements, placementId]);

    const form = useForm<PlacementSettingsFormValues>({
        values,
        defaultValues: {
            targetInteraction: "",
            buttonShare: {
                text: "",
                noRewardText: "",
                clickAction: "embedded-wallet",
                useReward: false,
                css: "",
            },
            buttonWallet: {
                position: "bottom-right",
                css: "",
            },
            openInApp: {
                text: "",
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
            const buttonWallet = {
                position: currentValues.buttonWallet.position,
                rawCss: valueOrUndefined(currentValues.buttonWallet.css),
            };
            const openInApp = {
                text: valueOrUndefined(currentValues.openInApp.text),
                rawCss: valueOrUndefined(currentValues.openInApp.css),
            };

            editSdkConfig({
                placements: updatePlacement(
                    sdkConfig,
                    placementId,
                    (placement) => ({
                        ...placement,
                        components: {
                            buttonShare,
                            buttonWallet,
                            openInApp,
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
                {selectedComponent === "buttonWallet" && (
                    <ButtonWalletFields form={form} />
                )}
                {selectedComponent === "openInApp" && (
                    <OpenInAppFields form={form} />
                )}

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

function ButtonShareFields({
    form,
}: {
    form: ReturnType<typeof useForm<PlacementSettingsFormValues>>;
}) {
    return (
        <div className={styles.customize__settingsGrid}>
            <FormField
                control={form.control}
                name="buttonShare.text"
                rules={{
                    maxLength: {
                        value: 500,
                        message: "Maximum length is 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Button text</FormLabel>
                        <FormDescription>
                            Label displayed on the share button
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={500}
                                placeholder={"Share and earn!"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="buttonShare.noRewardText"
                rules={{
                    maxLength: {
                        value: 500,
                        message: "Maximum length is 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            No-reward fallback text
                        </FormLabel>
                        <FormDescription>
                            Shown instead when no reward is available for this
                            campaign
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={500}
                                placeholder={"Share even without rewards"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="buttonShare.clickAction"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Click action</FormLabel>
                        <FormDescription>
                            What happens when a visitor clicks the share button
                        </FormDescription>
                        <FormControl>
                            <select
                                className={styles.customize__select}
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.value)}
                            >
                                <option value="embedded-wallet">
                                    Embedded wallet
                                </option>
                                <option value="share-modal">Share modal</option>
                                <option value="sharing-page">
                                    Sharing page
                                </option>
                            </select>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="buttonShare.useReward"
                render={({ field }) => (
                    <FormItem className={styles.customize__switchRow}>
                        <FormLabel weight={"medium"}>
                            Display estimated reward
                        </FormLabel>
                        <FormDescription>
                            Show the estimated reward amount directly on the
                            button
                        </FormDescription>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="buttonShare.css"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Component CSS</FormLabel>
                        <FormDescription>
                            Custom styles applied to the share button
                        </FormDescription>
                        <FormControl>
                            <textarea
                                className={styles.customize__textarea}
                                placeholder={".frak-button-share { ... }"}
                                rows={4}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}

function ButtonWalletFields({
    form,
}: {
    form: ReturnType<typeof useForm<PlacementSettingsFormValues>>;
}) {
    return (
        <div className={styles.customize__settingsGrid}>
            <FormField
                control={form.control}
                name="buttonWallet.position"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Position</FormLabel>
                        <FormDescription>
                            Screen corner where the floating wallet button
                            appears
                        </FormDescription>
                        <FormControl>
                            <select
                                className={styles.customize__select}
                                {...field}
                            >
                                <option value="bottom-right">
                                    Bottom right
                                </option>
                                <option value="bottom-left">Bottom left</option>
                            </select>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="buttonWallet.css"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Component CSS</FormLabel>
                        <FormDescription>
                            Custom styles applied to the wallet button
                        </FormDescription>
                        <FormControl>
                            <textarea
                                className={styles.customize__textarea}
                                placeholder={".frak-button-wallet { ... }"}
                                rows={4}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}

function OpenInAppFields({
    form,
}: {
    form: ReturnType<typeof useForm<PlacementSettingsFormValues>>;
}) {
    return (
        <div className={styles.customize__settingsGrid}>
            <FormField
                control={form.control}
                name="openInApp.text"
                rules={{
                    maxLength: {
                        value: 500,
                        message: "Maximum length is 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Button text</FormLabel>
                        <FormDescription>
                            Label on the &quot;Open in App&quot; button, shown
                            to mobile visitors
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={500}
                                placeholder={"Open in App"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="openInApp.css"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Component CSS</FormLabel>
                        <FormDescription>
                            Custom styles applied to the open-in-app button
                        </FormDescription>
                        <FormControl>
                            <textarea
                                className={styles.customize__textarea}
                                placeholder={".frak-open-in-app { ... }"}
                                rows={4}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}

function PlacementCssPanel({
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

    const values = useMemo<CssFormValues>(() => {
        const placement = sdkConfig.placements?.[placementId];
        return {
            css: placement?.rawCss ?? "",
        };
    }, [sdkConfig.placements, placementId]);

    const form = useForm<CssFormValues>({
        values,
        defaultValues: {
            css: "",
        },
    });

    useEffect(() => {
        onDirtyChange(`placement-${placementId}-css`, form.formState.isDirty);
        return () => onDirtyChange(`placement-${placementId}-css`, false);
    }, [form.formState.isDirty, onDirtyChange, placementId]);

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    return (
        <Panel title={`Placement CSS · ${placementId}`}>
            <p className={styles.customize__fieldDescription}>
                Global CSS overrides for this placement. Styles defined here
                apply to all SDK components within this placement.
            </p>
            <CssEditor
                value={form.watch("css")}
                onChange={(value) => {
                    form.setValue("css", value, { shouldDirty: true });
                }}
                placeholder={sdkConfig.rawCss ?? ".frak-modal { ... }"}
                isPending={isPending}
                isSuccess={isSuccess}
                isDirty={form.formState.isDirty}
                onDiscard={() => form.reset(values)}
                onSave={() =>
                    editSdkConfig({
                        placements: updatePlacement(
                            sdkConfig,
                            placementId,
                            (placement) => ({
                                ...placement,
                                rawCss: valueOrUndefined(form.getValues("css")),
                            })
                        ),
                    })
                }
            />
        </Panel>
    );
}

function PlacementTranslationsPanel({
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
    const [lang, setLang] = useState<TranslationLang>("default");

    const values = useMemo<TranslationFormValues>(
        () => getPlacementTranslationsFormValues(sdkConfig, placementId),
        [sdkConfig, placementId]
    );

    const inheritedValues = useMemo(
        () => getTranslationsFormValues(sdkConfig.translations),
        [sdkConfig.translations]
    );

    const form = useForm<TranslationFormValues>({
        values,
        defaultValues: {
            translationsDefault: {},
            translationsEn: {},
            translationsFr: {},
        },
    });

    useEffect(() => {
        onDirtyChange(
            `placement-${placementId}-translations`,
            form.formState.isDirty
        );
        return () =>
            onDirtyChange(`placement-${placementId}-translations`, false);
    }, [form.formState.isDirty, onDirtyChange, placementId]);

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    return (
        <Form {...form}>
            <Panel title={`Placement translations · ${placementId}`}>
                <LoginPreview
                    form={form}
                    logoUrl={sdkConfig.logoUrl ?? undefined}
                    currency={sdkConfig.currency ?? undefined}
                    lang={lang}
                    defaultValues={inheritedValues}
                />
                <TranslationEditor
                    form={form}
                    fieldPrefix={`placements.${placementId}.translations`}
                    defaultValues={inheritedValues}
                    lang={lang}
                    onLangChange={setLang}
                />

                <FormActions
                    isSuccess={isSuccess}
                    isPending={isPending}
                    isDirty={form.formState.isDirty}
                    onDiscard={() => form.reset(values)}
                    onSubmit={() => {
                        const payload = buildTranslationsPayload(
                            form.getValues()
                        );

                        editSdkConfig({
                            placements: updatePlacement(
                                sdkConfig,
                                placementId,
                                (placement) => ({
                                    ...placement,
                                    translations: payload.hasAnyValues
                                        ? payload.translations
                                        : undefined,
                                })
                            ),
                        });
                    }}
                />
            </Panel>
        </Form>
    );
}

function DeletePlacementPanel({
    merchantId,
    placementId,
    sdkConfig,
    onDelete,
}: {
    merchantId: string;
    placementId: string;
    sdkConfig: SdkConfig;
    onDelete: () => void;
}) {
    const { mutateAsync: editSdkConfig, isPending } = useMerchantUpdate({
        merchantId,
        target: "sdk-config",
    });
    const [open, setOpen] = useState(false);

    return (
        <Panel title={`Delete placement · ${placementId}`}>
            <p className={styles.customize__hint}>
                This removes all overrides for this placement.
            </p>
            <AlertDialog
                open={open}
                onOpenChange={setOpen}
                title={"Delete placement"}
                buttonElement={
                    <button
                        type="button"
                        className={styles.customize__deleteButton}
                    >
                        <Trash2 size={16} />
                        Delete {placementId}
                    </button>
                }
                description={`This will remove all overrides for placement ${placementId}.`}
                cancel={<Button variant={"outline"}>Cancel</Button>}
                action={
                    <Button
                        variant={"danger"}
                        isLoading={isPending}
                        disabled={isPending}
                        onClick={async () => {
                            const currentPlacements = {
                                ...(sdkConfig.placements ?? {}),
                            };
                            delete currentPlacements[placementId];
                            await editSdkConfig({
                                placements: currentPlacements,
                            });
                            onDelete();
                            setOpen(false);
                        }}
                    >
                        Delete placement
                    </Button>
                }
            />
        </Panel>
    );
}
