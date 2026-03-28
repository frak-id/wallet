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
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { FormActions } from "@/module/forms/FormActions";
import { Switch } from "@/module/forms/Switch";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import styles from "./index.module.css";
import { CssEditor, TranslationEditor } from "./TranslationEditor";
import {
    buildTranslationsPayload,
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

    const values = useMemo<PlacementSettingsFormValues>(() => {
        const placement = sdkConfig.placements?.[placementId];
        return {
            triggerText: placement?.trigger?.text ?? "",
            triggerNoRewardText: placement?.trigger?.noRewardText ?? "",
            triggerPosition: placement?.trigger?.position ?? "bottom-right",
            triggerShowWallet: placement?.trigger?.showWallet ?? false,
            targetInteraction: placement?.targetInteraction ?? "",
        };
    }, [sdkConfig.placements, placementId]);

    const form = useForm<PlacementSettingsFormValues>({
        values,
        defaultValues: {
            triggerText: "",
            triggerNoRewardText: "",
            triggerPosition: "bottom-right",
            triggerShowWallet: false,
            targetInteraction: "",
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
            editSdkConfig({
                placements: updatePlacement(
                    sdkConfig,
                    placementId,
                    (placement) => ({
                        ...placement,
                        trigger: {
                            text: valueOrUndefined(currentValues.triggerText),
                            noRewardText: valueOrUndefined(
                                currentValues.triggerNoRewardText
                            ),
                            position: currentValues.triggerPosition,
                            showWallet: currentValues.triggerShowWallet,
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
                        name="triggerText"
                        rules={{
                            maxLength: {
                                value: 500,
                                message: "Maximum length is 500 characters",
                            },
                        }}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel weight={"medium"}>
                                    Trigger text
                                </FormLabel>
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
                        name="triggerNoRewardText"
                        rules={{
                            maxLength: {
                                value: 500,
                                message: "Maximum length is 500 characters",
                            },
                        }}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel weight={"medium"}>
                                    Trigger no-reward text
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        length={"big"}
                                        maxLength={500}
                                        placeholder={
                                            "Share even without rewards"
                                        }
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="triggerPosition"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel weight={"medium"}>
                                    Trigger position
                                </FormLabel>
                                <FormControl>
                                    <select
                                        className={styles.customize__select}
                                        {...field}
                                    >
                                        <option value="bottom-right">
                                            Bottom right
                                        </option>
                                        <option value="bottom-left">
                                            Bottom left
                                        </option>
                                    </select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

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

                    <FormField
                        control={form.control}
                        name="triggerShowWallet"
                        render={({ field }) => (
                            <FormItem className={styles.customize__switchRow}>
                                <FormLabel weight={"medium"}>
                                    Show wallet shortcut
                                </FormLabel>
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
                </div>

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
            css: placement?.css ?? "",
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
            <CssEditor
                value={form.watch("css")}
                onChange={(value) => {
                    form.setValue("css", value, { shouldDirty: true });
                }}
                placeholder={sdkConfig.css ?? ".frak-modal { ... }"}
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
                                css: valueOrUndefined(form.getValues("css")),
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
