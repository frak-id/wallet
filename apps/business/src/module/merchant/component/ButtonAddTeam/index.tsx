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
import { type PropsWithChildren, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Address, isAddress } from "viem";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { SheetCloseToolbar } from "@/module/common/component/SheetCloseToolbar";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import { useAdminMutation } from "@/module/merchant/hook/useAdminMutation";
import * as styles from "./add-team-sheet.css";

export function ButtonAddTeam({
    merchantId,
    children,
}: PropsWithChildren<{ merchantId: string }>) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [wallet, setWallet] = useState("");

    const {
        mutate: addAdmin,
        isPending,
        isError,
    } = useAdminMutation({ action: "add" });

    const trimmed = wallet.trim();
    const isValid = useMemo(() => isAddress(trimmed), [trimmed]);

    const { guard, dialogProps } = useDiscardGuard({
        isDirty: trimmed.length > 0,
        onDiscard: () => setWallet(""),
    });

    function handleAdd() {
        if (!isValid) return;
        addAdmin(
            { merchantId, wallet: trimmed as Address },
            {
                onSuccess: () => {
                    setWallet("");
                    setOpen(false);
                },
            }
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
            <SheetTrigger asChild>{children}</SheetTrigger>
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
                    title={t("merchantEdit.team.add.title")}
                    subtitle={t("merchantEdit.team.add.description")}
                />

                <Stack space="l" padding="l">
                    <Stack space="m" padding="m" className={styles.fieldCard}>
                        <Stack space="xs">
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                                className={styles.inputLabel}
                            >
                                {t("merchantEdit.team.add.label")}
                            </Text>
                            <Input
                                variant="bare"
                                tone="muted"
                                length="big"
                                value={wallet}
                                onChange={(e) => setWallet(e.target.value)}
                                placeholder={t(
                                    "merchantEdit.team.add.placeholder"
                                )}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAdd();
                                }}
                            />
                            {trimmed && !isValid && (
                                <Text variant="caption" color="error">
                                    {t("merchantEdit.team.add.invalid")}
                                </Text>
                            )}
                            {isError && (
                                <Text variant="caption" color="error">
                                    {t("merchantEdit.team.add.error")}
                                </Text>
                            )}
                        </Stack>

                        <Inline space="m" align="center">
                            <Button
                                variant="primary"
                                size="large"
                                width="auto"
                                onClick={handleAdd}
                                disabled={!isValid || isPending}
                                loading={isPending}
                            >
                                {t("merchantEdit.team.add.submit")}
                            </Button>
                        </Inline>
                    </Stack>
                </Stack>
            </SheetContent>
            <DiscardChangesDialog {...dialogProps} />
        </Sheet>
    );
}
