import { Button } from "@frak-labs/design-system/components/Button";
import { GlassCloseButton } from "@frak-labs/design-system/components/GlassCloseButton";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import {
    Sheet,
    SheetContent,
    SheetToolbar,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button as BusinessButton } from "@/module/common/component/Button";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import {
    useAddAllowedDomain,
    useRemoveAllowedDomain,
} from "@/module/merchant/hook/useAllowedDomains";
import * as styles from "./allowed-domains-sheet.css";

const domainRegex =
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function normalizeDomain(raw: string): string {
    return raw
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")
        .replace(/:\d+$/, "")
        .replace(/^www\./, "");
}

export function AllowedDomainsSheet({
    merchantId,
    allowedDomains,
}: {
    merchantId: string;
    allowedDomains: string[];
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [rawInput, setRawInput] = useState("");

    const { mutate: addDomain, isPending: isAdding } = useAddAllowedDomain({
        merchantId,
    });
    const { mutate: removeDomain, isPending: isRemoving } =
        useRemoveAllowedDomain({ merchantId });

    const normalized = useMemo(() => normalizeDomain(rawInput), [rawInput]);
    const isValid = normalized.length > 0 && domainRegex.test(normalized);

    const { guard, dialogProps } = useDiscardGuard({
        isDirty: rawInput.trim().length > 0,
        onDiscard: () => setRawInput(""),
    });

    function handleAdd() {
        if (!isValid) return;
        addDomain(normalized, {
            onSuccess: () => setRawInput(""),
        });
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
                    {t("merchantEdit.domains.manage")}
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
                <SheetToolbar
                    size="large"
                    leading={
                        <GlassCloseButton
                            onClick={requestClose}
                            aria-label={t("merchantEdit.close")}
                        />
                    }
                    title={t("merchantEdit.domains.title")}
                    subtitle={t("merchantEdit.domains.description")}
                />

                <Stack space="l" padding="l">
                    <Stack space="m" padding="m" className={styles.domainCard}>
                        {allowedDomains.length > 0 ? (
                            <Stack
                                as="ul"
                                space="none"
                                className={styles.domainList}
                            >
                                {allowedDomains.map((domain) => (
                                    <Inline
                                        as="li"
                                        wrap={false}
                                        space="s"
                                        alignY="center"
                                        key={domain}
                                        className={styles.domainItem}
                                    >
                                        <span className={styles.domainText}>
                                            {domain}
                                        </span>
                                        <Button
                                            variant="destructive"
                                            size="small"
                                            onClick={() => removeDomain(domain)}
                                            disabled={isRemoving}
                                        >
                                            {t("merchantEdit.domains.remove")}
                                        </Button>
                                    </Inline>
                                ))}
                            </Stack>
                        ) : (
                            <Text variant="caption" color="tertiary">
                                {t("merchantEdit.domains.empty")}
                            </Text>
                        )}

                        <Stack space="xs">
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                                className={styles.inputLabel}
                            >
                                {t("merchantEdit.domains.additionalLabel")}
                            </Text>
                            <Input
                                variant="bare"
                                tone="muted"
                                length="big"
                                value={rawInput}
                                onChange={(e) => setRawInput(e.target.value)}
                                placeholder={t(
                                    "merchantEdit.domains.placeholder"
                                )}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAdd();
                                }}
                            />
                            {rawInput.trim() && !isValid && (
                                <Text variant="caption" color="error">
                                    {t("merchantEdit.domains.invalid")}
                                </Text>
                            )}
                        </Stack>
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
                            {t("merchantEdit.domains.add")}
                        </Button>
                    </Inline>
                </Stack>
            </SheetContent>
            <DiscardChangesDialog {...dialogProps} />
        </Sheet>
    );
}
