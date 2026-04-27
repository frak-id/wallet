import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon } from "@frak-labs/design-system/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    type IbanEntry,
    ibanStore,
    selectEffectiveIban,
    selectKnownIbans,
} from "@/module/monerium/store/ibanStore";
import {
    moneriumFlowStore,
    selectSelectedIbanOverride,
} from "@/module/monerium/store/moneriumFlowStore";
import { maskIban } from "@/module/monerium/utils/maskIban";
import * as styles from "./index.css";
import { MoneriumScreen } from "./MoneriumScreen";

function isValidIbanFormat(value: string): boolean {
    const cleaned = value.replace(/\s/g, "").toUpperCase();
    // Minimum-length IBAN check (15-34 chars, starts with two letters then digits/letters).
    return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(cleaned);
}

export function MoneriumTransferIbanScreen() {
    const { t } = useTranslation();
    const knownIbans = ibanStore(selectKnownIbans);
    const addIban = ibanStore((s) => s.addIban);
    const removeIban = ibanStore((s) => s.removeIban);
    const setLastUsedIban = ibanStore((s) => s.setLastUsedIban);

    const goTo = moneriumFlowStore((s) => s.goTo);
    const setSelectedIban = moneriumFlowStore((s) => s.setSelectedIban);
    const currentOverride = moneriumFlowStore(selectSelectedIbanOverride);
    const effectiveIban = ibanStore(selectEffectiveIban);
    // `moneriumFlowStore` is in-memory; fall back to persisted last-used.
    const currentIban = (currentOverride ?? effectiveIban)?.iban ?? null;

    const [name, setName] = useState("");
    const [iban, setIban] = useState("");

    const canSave = name.trim().length > 0 && isValidIbanFormat(iban);

    function handleSelect(entry: IbanEntry) {
        setLastUsedIban(entry.iban);
        setSelectedIban(entry);
        goTo("transfer-amount");
    }

    function handleSave() {
        if (!canSave) return;
        const trimmed = { name: name.trim(), iban: iban.trim() };
        addIban(trimmed);
        setLastUsedIban(trimmed.iban);
        setName("");
        setIban("");
        handleSelect({
            name: trimmed.name,
            iban: trimmed.iban.replace(/\s/g, "").toUpperCase(),
        });
    }

    return (
        <MoneriumScreen
            onClose={() => goTo("transfer-amount")}
            leftIcon="back"
            title={t("monerium.bankFlow.transfer.ibanManager.title")}
            ctaLabel={t("monerium.bankFlow.transfer.ibanManager.save")}
            ctaOnClick={handleSave}
            ctaDisabled={!canSave}
        >
            {knownIbans.length === 0 ? (
                <Text variant="body" color="secondary">
                    {t("monerium.bankFlow.transfer.ibanManager.empty")}
                </Text>
            ) : (
                <Stack space="xs">
                    {knownIbans.map((entry) => {
                        const isSelected = entry.iban === currentIban;
                        return (
                            <Card
                                key={entry.iban}
                                variant="elevated"
                                padding="none"
                                className={`${styles.transferCellPadding}${
                                    isSelected
                                        ? ` ${styles.ibanCardSelected}`
                                        : ""
                                }`}
                                aria-current={isSelected ? "true" : undefined}
                            >
                                <Inline
                                    space="m"
                                    alignY="center"
                                    align="space-between"
                                    wrap={false}
                                >
                                    <button
                                        type="button"
                                        className={styles.ibanRow}
                                        onClick={() => handleSelect(entry)}
                                    >
                                        <Stack space="xxs">
                                            <Text
                                                variant="body"
                                                weight="medium"
                                            >
                                                {entry.name}
                                            </Text>
                                            <Text
                                                variant="bodySmall"
                                                color="secondary"
                                            >
                                                {maskIban(entry.iban)}
                                            </Text>
                                        </Stack>
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.linkButton}
                                        onClick={() => removeIban(entry.iban)}
                                        aria-label={t(
                                            "monerium.bankFlow.transfer.ibanManager.remove"
                                        )}
                                    >
                                        <Box
                                            color="tertiary"
                                            display="flex"
                                            alignItems="center"
                                        >
                                            <CloseIcon width={16} height={16} />
                                        </Box>
                                    </button>
                                </Inline>
                            </Card>
                        );
                    })}
                </Stack>
            )}

            <Stack space="m">
                <Text variant="heading4">
                    {t("monerium.bankFlow.transfer.ibanManager.addNew")}
                </Text>

                <Stack space="xs">
                    <Box paddingX="m">
                        <Text
                            variant="bodySmall"
                            weight="medium"
                            color="secondary"
                        >
                            {t(
                                "monerium.bankFlow.transfer.ibanManager.nameLabel"
                            )}
                        </Text>
                    </Box>
                    <Input
                        variant="bare"
                        length="big"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t(
                            "monerium.bankFlow.transfer.ibanManager.namePlaceholder"
                        )}
                        aria-label={t(
                            "monerium.bankFlow.transfer.ibanManager.nameLabel"
                        )}
                    />
                </Stack>

                <Stack space="xs">
                    <Box paddingX="m">
                        <Text
                            variant="bodySmall"
                            weight="medium"
                            color="secondary"
                        >
                            {t(
                                "monerium.bankFlow.transfer.ibanManager.ibanLabel"
                            )}
                        </Text>
                    </Box>
                    <Input
                        variant="bare"
                        length="big"
                        value={iban}
                        onChange={(e) => setIban(e.target.value)}
                        placeholder={t(
                            "monerium.bankFlow.transfer.ibanManager.ibanPlaceholder"
                        )}
                        aria-label={t(
                            "monerium.bankFlow.transfer.ibanManager.ibanLabel"
                        )}
                    />
                </Stack>
            </Stack>
        </MoneriumScreen>
    );
}
