import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Button } from "@/module/common/component/Button";
import { Form } from "@/module/forms/Form";
import { FormActions } from "@/module/forms/FormActions";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import * as styles from "./customize.css";
import { SharingPagePreview } from "./ModalPreview";
import { CssEditor, TranslationEditor } from "./TranslationEditor";
import type {
    CssFormValues,
    TranslationFormValues,
    TranslationLang,
} from "./types";
import {
    buildTranslationsPayload,
    getPlacementTranslationsFormValues,
    getTranslationsFormValues,
    updatePlacement,
    valueOrUndefined,
} from "./utils";

export function PlacementCssPanel({
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
        <Card>
            <CardHeader>
                <CardTitle>{`Placement CSS · ${placementId}`}</CardTitle>
            </CardHeader>
            <p className={styles.customizeFieldDescription}>
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
        </Card>
    );
}

export function PlacementTranslationsPanel({
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

    const handleSubmit = useCallback(() => {
        const payload = buildTranslationsPayload(form.getValues());
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
    }, [editSdkConfig, form, sdkConfig, placementId]);

    return (
        <Form {...form}>
            <Card>
                <CardHeader>
                    <CardTitle>{`Placement translations · ${placementId}`}</CardTitle>
                </CardHeader>
                <SharingPagePreview
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
                    onSubmit={handleSubmit}
                />
            </Card>
        </Form>
    );
}

export function DeletePlacementPanel({
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
        <Card>
            <CardHeader>
                <CardTitle>{`Delete placement · ${placementId}`}</CardTitle>
            </CardHeader>
            <p className={styles.customizeHint}>
                This removes all overrides for this placement.
            </p>
            <AlertDialog
                open={open}
                onOpenChange={setOpen}
                title={"Delete placement"}
                buttonElement={
                    <button
                        type="button"
                        className={styles.customizeDeleteButton}
                    >
                        <Trash2 size={16} />
                        Delete {placementId}
                    </button>
                }
                description={`This will remove all overrides for placement ${placementId}.`}
                cancel={<Button variant={"secondary"}>Cancel</Button>}
                action={
                    <Button
                        variant={"destructive"}
                        loading={isPending}
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
        </Card>
    );
}
