import { Card } from "@frak-labs/design-system/components/Card";
import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Button } from "@/module/common/component/Button";
import { Input } from "@/module/forms/Input";
import * as styles from "./customize.css";

const MAX_PLACEMENTS = 10;
const ADD_PLACEMENT = "__add-placement__";

export function PlacementSelector({
    activeTab,
    placementIds,
    onTabChange,
    onCreatePlacement,
    isCreatingPlacement,
    isCreatePlacementSuccess,
}: {
    activeTab: "default" | string;
    placementIds: string[];
    onTabChange: (tab: "default" | string) => void;
    onCreatePlacement: (placementId: string) => Promise<void>;
    isCreatingPlacement: boolean;
    isCreatePlacementSuccess: boolean;
}) {
    const { t } = useTranslation();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    return (
        <Card radius="m">
            <Stack space="xs">
                <Stack space="xxs">
                    <Text variant="bodySmall" weight="medium" color="secondary">
                        {t("customize.placements.title")}
                    </Text>
                    <Text variant="caption" color="tertiary">
                        {t("customize.placements.description")}
                    </Text>
                </Stack>
                <RadioGroup
                    value={activeTab}
                    onValueChange={(value) => {
                        if (value === ADD_PLACEMENT) {
                            setIsCreateOpen(true);
                            return;
                        }
                        onTabChange(value);
                    }}
                >
                    <PlacementRow
                        value="default"
                        label={t("customize.placements.globalDefault")}
                    />
                    {placementIds.map((placementId) => (
                        <PlacementRow
                            key={placementId}
                            value={placementId}
                            label={placementId}
                        />
                    ))}
                    <PlacementRow
                        value={ADD_PLACEMENT}
                        label={t("customize.placements.add")}
                        disabled={placementIds.length >= MAX_PLACEMENTS}
                    />
                </RadioGroup>
            </Stack>
            <CreatePlacementDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                placementIds={placementIds}
                onCreatePlacement={onCreatePlacement}
                isCreatingPlacement={isCreatingPlacement}
                isCreatePlacementSuccess={isCreatePlacementSuccess}
            />
        </Card>
    );
}

function PlacementRow({
    value,
    label,
    disabled,
}: {
    value: string;
    label: string;
    disabled?: boolean;
}) {
    const id = useId();
    return (
        <div className={styles.radioRow}>
            <RadioGroupItem
                id={id}
                value={value}
                size="l"
                disabled={disabled}
            />
            <label htmlFor={id} className={styles.radioRowLabel}>
                <Text variant="body" weight="medium" as="span">
                    {label}
                </Text>
            </label>
        </div>
    );
}

function CreatePlacementDialog({
    open,
    onOpenChange,
    placementIds,
    onCreatePlacement,
    isCreatingPlacement,
    isCreatePlacementSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    placementIds: string[];
    onCreatePlacement: (placementId: string) => Promise<void>;
    isCreatingPlacement: boolean;
    isCreatePlacementSuccess: boolean;
}) {
    const { t } = useTranslation();
    const [newPlacementId, setNewPlacementId] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isCreatePlacementSuccess || !open) return;
        onOpenChange(false);
    }, [isCreatePlacementSuccess, open, onOpenChange]);

    function validatePlacementId(value: string) {
        const placementId = value.trim();

        if (placementIds.length >= MAX_PLACEMENTS) {
            return t("customize.placements.dialog.errorMax");
        }

        if (!/^[a-zA-Z0-9_-]{3,16}$/.test(placementId)) {
            return t("customize.placements.dialog.errorFormat");
        }

        if (placementIds.includes(placementId)) {
            return t("customize.placements.dialog.errorExists");
        }

        return null;
    }

    async function handleCreate() {
        const validationError = validatePlacementId(newPlacementId);
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);
        await onCreatePlacement(newPlacementId.trim());
        setNewPlacementId("");
    }

    return (
        <AlertDialog
            open={open}
            onOpenChange={(nextOpen) => {
                onOpenChange(nextOpen);
                if (!nextOpen) {
                    setError(null);
                    setNewPlacementId("");
                }
            }}
            title={t("customize.placements.dialog.title")}
            description={
                <div className={styles.dialogBody}>
                    <Text variant="caption" color="tertiary" as="span">
                        {t("customize.placements.dialog.hint")}
                    </Text>
                    <Input
                        length={"big"}
                        value={newPlacementId}
                        onChange={(event) => {
                            setNewPlacementId(event.target.value);
                            setError(null);
                        }}
                        placeholder={"homepage_banner"}
                        maxLength={16}
                    />
                    {error && (
                        <Text variant="caption" color="error" as="span">
                            {error}
                        </Text>
                    )}
                </div>
            }
            cancel={
                <Button variant={"secondary"}>
                    {t("customize.placements.dialog.cancel")}
                </Button>
            }
            action={
                <Button
                    variant={"primary"}
                    onClick={handleCreate}
                    loading={isCreatingPlacement}
                    disabled={isCreatingPlacement}
                >
                    {t("customize.placements.dialog.create")}
                </Button>
            }
        />
    );
}
