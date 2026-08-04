import { isValidPackageId } from "@frak-labs/app-essentials";
import type { AllowedPackageId } from "@frak-labs/backend-elysia/api/schemas";
import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button as BusinessButton } from "@/module/common/component/Button";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { SheetCloseToolbar } from "@/module/common/component/SheetCloseToolbar";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import {
    useAddAllowedPackageId,
    useRemoveAllowedPackageId,
} from "@/module/merchant/hook/useAllowedPackageIds";
import { AllowedListErrorMessage } from "../AllowedListError";
import * as sharedStyles from "../allowed-list-sheet.css";
import * as styles from "./allowed-package-ids-sheet.css";

const platforms = ["android", "ios"] as const;

export function AllowedPackageIdsSheet({
    merchantId,
    allowedPackageIds,
}: {
    merchantId: string;
    allowedPackageIds: AllowedPackageId[];
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [rawInput, setRawInput] = useState("");
    const [platform, setPlatform] =
        useState<AllowedPackageId["platform"]>("android");

    const {
        mutate: addPackageId,
        isPending: isAdding,
        error: addError,
        reset: resetAddError,
    } = useAddAllowedPackageId({ merchantId });
    const { mutate: removePackageId, isPending: isRemoving } =
        useRemoveAllowedPackageId({ merchantId });

    const isValid = isValidPackageId(rawInput);

    const { guard, dialogProps } = useDiscardGuard({
        isDirty: rawInput.trim().length > 0,
        onDiscard: () => setRawInput(""),
    });

    function handleAdd() {
        if (!isValid) return;
        addPackageId(
            { packageId: rawInput.trim().toLowerCase(), platform },
            { onSuccess: () => setRawInput("") }
        );
    }

    function requestClose() {
        guard(() => setOpen(false));
    }

    return (
        <Sheet
            open={open}
            onOpenChange={(next) => {
                if (next) {
                    setOpen(true);
                    return;
                }
                requestClose();
            }}
        >
            <SheetTrigger asChild>
                <BusinessButton variant="secondary" size="small">
                    {t("merchantEdit.packageIds.manage")}
                </BusinessButton>
            </SheetTrigger>
            <SheetContent
                side="right"
                size="wide"
                padded={false}
                hideCloseButton
                onEscapeKeyDown={(e) => {
                    e.preventDefault();
                    requestClose();
                }}
                onInteractOutside={(e) => {
                    e.preventDefault();
                    requestClose();
                }}
            >
                <SheetCloseToolbar
                    size="large"
                    onClose={requestClose}
                    closeLabel={t("merchantEdit.close")}
                    title={t("merchantEdit.packageIds.title")}
                    subtitle={t("merchantEdit.packageIds.description")}
                />

                <Stack space="l" padding="l">
                    {allowedPackageIds.length > 0 && (
                        <Stack
                            space="m"
                            padding="m"
                            className={sharedStyles.card}
                        >
                            <Stack
                                as="ul"
                                space="none"
                                className={sharedStyles.list}
                            >
                                {allowedPackageIds.map((entry) => (
                                    <Inline
                                        as="li"
                                        wrap={false}
                                        space="s"
                                        alignY="center"
                                        key={`${entry.platform}:${entry.packageId}`}
                                        className={sharedStyles.item}
                                    >
                                        <span className={styles.platformBadge}>
                                            {t(
                                                `merchantEdit.packageIds.platform.${entry.platform}`
                                            )}
                                        </span>
                                        <span className={sharedStyles.itemText}>
                                            {entry.packageId}
                                        </span>
                                        <Button
                                            variant="destructive"
                                            size="small"
                                            width="auto"
                                            onClick={() =>
                                                removePackageId(entry)
                                            }
                                            disabled={isRemoving}
                                        >
                                            {t(
                                                "merchantEdit.packageIds.remove"
                                            )}
                                        </Button>
                                    </Inline>
                                ))}
                            </Stack>
                        </Stack>
                    )}

                    <Stack space="m" padding="m" className={sharedStyles.card}>
                        <Stack space="xs">
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                                className={sharedStyles.inputLabel}
                            >
                                {t("merchantEdit.packageIds.platformLabel")}
                            </Text>
                            <Inline
                                space="s"
                                className={sharedStyles.inputLabel}
                            >
                                {platforms.map((option) => (
                                    <Button
                                        key={option}
                                        variant={
                                            platform === option
                                                ? "primary"
                                                : "secondary"
                                        }
                                        size="small"
                                        width="auto"
                                        onClick={() => setPlatform(option)}
                                    >
                                        {t(
                                            `merchantEdit.packageIds.platform.${option}`
                                        )}
                                    </Button>
                                ))}
                            </Inline>
                        </Stack>

                        <Stack space="xs">
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                                className={sharedStyles.inputLabel}
                            >
                                {t("merchantEdit.packageIds.additionalLabel")}
                            </Text>
                            <Input
                                variant="bare"
                                tone="muted"
                                length="big"
                                value={rawInput}
                                onChange={(e) => {
                                    setRawInput(e.target.value);
                                    resetAddError();
                                }}
                                placeholder={t(
                                    `merchantEdit.packageIds.placeholder.${platform}`
                                )}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAdd();
                                }}
                            />
                            {rawInput.trim() && !isValid && (
                                <Text variant="caption" color="error">
                                    {t("merchantEdit.packageIds.invalid")}
                                </Text>
                            )}
                            {addError && (
                                <AllowedListErrorMessage
                                    error={addError}
                                    claimedCode="PACKAGE_ID_ALREADY_CLAIMED"
                                    claimedKey="merchantEdit.packageIds.claimed"
                                    fallbackKey="merchantEdit.packageIds.addError"
                                />
                            )}
                        </Stack>

                        <Inline space="m" align="center">
                            <Button
                                variant="primary"
                                size="large"
                                width="auto"
                                onClick={handleAdd}
                                disabled={!isValid || isAdding}
                                loading={isAdding}
                            >
                                {t("merchantEdit.packageIds.add")}
                            </Button>
                        </Inline>
                    </Stack>
                </Stack>
            </SheetContent>
            <DiscardChangesDialog {...dialogProps} />
        </Sheet>
    );
}
