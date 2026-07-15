import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Notice } from "@frak-labs/design-system/components/Notice";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { Text } from "@frak-labs/design-system/components/Text";
import { type PropsWithChildren, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Address, isAddress } from "viem";
import { extractAuthErrorMessage } from "@/module/auth/utils/authError";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { SheetCloseToolbar } from "@/module/common/component/SheetCloseToolbar";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import { useAdminMutation } from "@/module/merchant/hook/useAdminMutation";
import * as styles from "./add-team-sheet.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ButtonAddTeam({
    merchantId,
    children,
}: PropsWithChildren<{ merchantId: string }>) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<"wallet" | "email">("wallet");
    const [wallet, setWallet] = useState("");
    const [email, setEmail] = useState("");

    const {
        mutate: addAdmin,
        isPending,
        isError,
        error,
    } = useAdminMutation({ action: "add" });
    const [addedResult, setAddedResult] = useState<{
        status: "active" | "invited";
        value: string;
    } | null>(null);

    const trimmedWallet = wallet.trim();
    const trimmedEmail = email.trim();
    const isWalletValid = useMemo(
        () => isAddress(trimmedWallet),
        [trimmedWallet]
    );
    const isEmailValid = useMemo(
        () => EMAIL_PATTERN.test(trimmedEmail),
        [trimmedEmail]
    );
    const isValid = mode === "wallet" ? isWalletValid : isEmailValid;
    const value = mode === "wallet" ? trimmedWallet : trimmedEmail;

    const { guard, dialogProps } = useDiscardGuard({
        isDirty: value.length > 0,
        onDiscard: () => {
            setWallet("");
            setEmail("");
        },
    });

    function handleAdd() {
        if (!isValid) return;
        addAdmin(
            mode === "wallet"
                ? { merchantId, wallet: trimmedWallet as Address }
                : { merchantId, email: trimmedEmail },
            {
                onSuccess: (data) => {
                    if (data) setAddedResult({ status: data.status, value });
                    setWallet("");
                    setEmail("");
                    setOpen(false);
                },
            }
        );
    }

    function requestClose() {
        guard(() => setOpen(false));
    }

    return (
        <Stack space="s">
            <Sheet
                open={open}
                onOpenChange={(next) => {
                    if (next) {
                        setOpen(true);
                        if (addedResult) setAddedResult(null);
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
                        <Stack
                            space="m"
                            padding="m"
                            className={styles.fieldCard}
                        >
                            <Tabs
                                value={mode}
                                onValueChange={(next) =>
                                    setMode(next as "wallet" | "email")
                                }
                            >
                                <TabsList variant="segmented">
                                    <TabsTrigger
                                        value="wallet"
                                        variant="segmented"
                                    >
                                        {t("merchantEdit.team.add.modeWallet")}
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="email"
                                        variant="segmented"
                                    >
                                        {t("merchantEdit.team.add.modeEmail")}
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <Stack space="xs">
                                <Text
                                    variant="bodySmall"
                                    weight="medium"
                                    color="secondary"
                                    className={styles.inputLabel}
                                >
                                    {mode === "wallet"
                                        ? t("merchantEdit.team.add.label")
                                        : t("merchantEdit.team.add.emailLabel")}
                                </Text>
                                {mode === "wallet" ? (
                                    <Input
                                        variant="bare"
                                        tone="muted"
                                        length="big"
                                        value={wallet}
                                        onChange={(e) =>
                                            setWallet(e.target.value)
                                        }
                                        placeholder={t(
                                            "merchantEdit.team.add.placeholder"
                                        )}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleAdd();
                                        }}
                                    />
                                ) : (
                                    <Input
                                        type="email"
                                        variant="bare"
                                        tone="muted"
                                        length="big"
                                        value={email}
                                        onChange={(e) =>
                                            setEmail(e.target.value)
                                        }
                                        placeholder={t(
                                            "merchantEdit.team.add.emailPlaceholder"
                                        )}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleAdd();
                                        }}
                                    />
                                )}
                                {value && !isValid && (
                                    <Text variant="caption" color="error">
                                        {mode === "wallet"
                                            ? t("merchantEdit.team.add.invalid")
                                            : t(
                                                  "merchantEdit.team.add.emailInvalid"
                                              )}
                                    </Text>
                                )}
                                {isError && (
                                    <Text variant="caption" color="error">
                                        {extractAuthErrorMessage(
                                            error,
                                            t("merchantEdit.team.add.error")
                                        )}
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
            {addedResult && (
                <Notice tone="success" role="status">
                    {addedResult.status === "invited"
                        ? t("merchantEdit.team.add.invitedSuccess", {
                              email: addedResult.value,
                          })
                        : t("merchantEdit.team.add.addedSuccess", {
                              email: addedResult.value,
                          })}
                </Notice>
            )}
        </Stack>
    );
}
