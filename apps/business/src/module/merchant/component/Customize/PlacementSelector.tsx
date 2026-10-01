import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Text } from "@frak-labs/design-system/components/Text";
import { useState } from "react";
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
}: {
    activeTab: "default" | string;
    placementIds: string[];
    onTabChange: (tab: "default" | string) => void;
    onCreatePlacement: (placementId: string) => Promise<void>;
    isCreatingPlacement: boolean;
}) {
    const { t } = useTranslation();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    return (
        <>
            <Select
                value={activeTab}
                onValueChange={(value) => {
                    if (value === ADD_PLACEMENT) {
                        setIsCreateOpen(true);
                        return;
                    }
                    onTabChange(value);
                }}
            >
                <SelectTrigger
                    variant="bare"
                    tone="muted"
                    aria-label={t("customize.placements.label")}
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="default">
                        {t("customize.placements.globalDefault")}
                    </SelectItem>
                    {placementIds.map((placementId) => (
                        <SelectItem key={placementId} value={placementId}>
                            {placementId}
                        </SelectItem>
                    ))}
                    <SelectItem
                        value={ADD_PLACEMENT}
                        disabled={placementIds.length >= MAX_PLACEMENTS}
                    >
                        {t("customize.placements.add")}
                    </SelectItem>
                </SelectContent>
            </Select>
            <CreatePlacementDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                placementIds={placementIds}
                onCreatePlacement={onCreatePlacement}
                isCreatingPlacement={isCreatingPlacement}
            />
        </>
    );
}

function CreatePlacementDialog({
    open,
    onOpenChange,
    placementIds,
    onCreatePlacement,
    isCreatingPlacement,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    placementIds: string[];
    onCreatePlacement: (placementId: string) => Promise<void>;
    isCreatingPlacement: boolean;
}) {
    const { t } = useTranslation();
    const [newPlacementId, setNewPlacementId] = useState("");
    const [error, setError] = useState<string | null>(null);

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
        onOpenChange(false);
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
