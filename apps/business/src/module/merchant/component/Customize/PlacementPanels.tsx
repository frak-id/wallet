import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Button } from "@/module/common/component/Button";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { CssEditor } from "./CssEditor";
import * as styles from "./customize.css";
import { useCustomizeSection } from "./saveRegistry";
import type { CssFormValues } from "./types";
import { updatePlacement, valueOrUndefined } from "./utils";

export function PlacementCssPanel({
    merchantId,
    placementId,
    sdkConfig,
}: {
    merchantId: string;
    placementId: string;
    sdkConfig: SdkConfig;
}) {
    const { t } = useTranslation();
    const { mutateAsync: editSdkConfig, isSuccess } = useMerchantUpdate({
        merchantId,
        target: "sdk-config",
    });

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
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    const onSubmit = useCallback(
        (v: CssFormValues) =>
            editSdkConfig({
                placements: updatePlacement(
                    sdkConfig,
                    placementId,
                    (placement) => ({
                        ...placement,
                        rawCss: valueOrUndefined(v.css),
                    })
                ),
            }),
        [editSdkConfig, sdkConfig, placementId]
    );

    useCustomizeSection(`placement-${placementId}-css`, form, onSubmit);

    return (
        <Card radius="m">
            <Stack space="m">
                <Stack space="xxs">
                    <Text variant="bodySmall" weight="medium" color="secondary">
                        {t("customize.placements.css.title", { placementId })}
                    </Text>
                    <Text variant="caption" color="tertiary">
                        {t("customize.placements.css.description")}
                    </Text>
                </Stack>
                <CssEditor
                    value={form.watch("css")}
                    onChange={(value) => {
                        form.setValue("css", value, { shouldDirty: true });
                    }}
                    placeholder={sdkConfig.rawCss ?? ".frak-modal { ... }"}
                />
            </Stack>
        </Card>
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
    const { t } = useTranslation();
    const { mutateAsync: editSdkConfig, isPending } = useMerchantUpdate({
        merchantId,
        target: "sdk-config",
    });
    const [open, setOpen] = useState(false);

    return (
        <Card radius="m">
            <Stack space="m">
                <Stack space="xxs">
                    <Text variant="bodySmall" weight="medium" color="secondary">
                        {t("customize.placements.delete.title", {
                            placementId,
                        })}
                    </Text>
                    <Text variant="caption" color="tertiary">
                        {t("customize.placements.delete.hint")}
                    </Text>
                </Stack>
                <AlertDialog
                    open={open}
                    onOpenChange={setOpen}
                    title={t("customize.placements.delete.dialogTitle")}
                    buttonElement={
                        <button type="button" className={styles.deleteButton}>
                            <Trash2 size={16} />
                            {t("customize.placements.delete.action", {
                                placementId,
                            })}
                        </button>
                    }
                    description={t("customize.placements.delete.description", {
                        placementId,
                    })}
                    cancel={
                        <Button variant={"secondary"}>
                            {t("customize.placements.delete.cancel")}
                        </Button>
                    }
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
                            {t("customize.placements.delete.confirm")}
                        </Button>
                    }
                />
            </Stack>
        </Card>
    );
}
