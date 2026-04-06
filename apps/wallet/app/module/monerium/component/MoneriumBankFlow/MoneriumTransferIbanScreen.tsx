import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CheckIcon,
    CloseIcon,
    TransferIcon,
} from "@frak-labs/design-system/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    type IbanEntry,
    ibanStore,
    selectKnownIbans,
} from "@/module/monerium/store/ibanStore";
import * as styles from "./index.css";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumTransferIbanScreenProps = {
    onBack: () => void;
    onSelect: (entry: IbanEntry) => void;
    currentIban: string | null;
};

function maskIban(iban: string): string {
    const cleaned = iban.replace(/\s/g, "");
    if (cleaned.length <= 8) return cleaned;
    return `${cleaned.slice(0, 4)} •••• ${cleaned.slice(-4)}`;
}

function isValidIbanFormat(value: string): boolean {
    const cleaned = value.replace(/\s/g, "").toUpperCase();
    // Minimum-length IBAN check (15-34 chars, starts with two letters then digits/letters).
    return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(cleaned);
}

/**
 * Beneficiary IBAN manager — list existing IBANs, add new ones, remove,
 * and pick one as the selected beneficiary for the current transfer.
 */
export function MoneriumTransferIbanScreen({
    onBack,
    onSelect,
    currentIban,
}: MoneriumTransferIbanScreenProps) {
    const { t } = useTranslation();
    const knownIbans = ibanStore(selectKnownIbans);
    const addIban = ibanStore((s) => s.addIban);
    const removeIban = ibanStore((s) => s.removeIban);
    const setLastUsedIban = ibanStore((s) => s.setLastUsedIban);

    const [name, setName] = useState("");
    const [iban, setIban] = useState("");

    const canSave = name.trim().length > 0 && isValidIbanFormat(iban);

    function handleSave() {
        if (!canSave) return;
        const trimmed = { name: name.trim(), iban: iban.trim() };
        addIban(trimmed);
        setLastUsedIban(trimmed.iban);
        setName("");
        setIban("");
        // Immediately select the just-added IBAN.
        onSelect({
            name: trimmed.name,
            iban: trimmed.iban.replace(/\s/g, "").toUpperCase(),
        });
    }

    function handlePick(entry: IbanEntry) {
        setLastUsedIban(entry.iban);
        onSelect(entry);
    }

    return (
        <MoneriumScreen onClose={onBack} leftIcon="back">
            <Stack space="l">
                <Text variant="heading2">
                    {t("monerium.bankFlow.transfer.ibanManager.title")}
                </Text>

                {/* Known IBANs list */}
                {knownIbans.length === 0 ? (
                    <Text variant="body" color="secondary">
                        {t("monerium.bankFlow.transfer.ibanManager.empty")}
                    </Text>
                ) : (
                    <Stack space="s">
                        {knownIbans.map((entry) => {
                            const isSelected = entry.iban === currentIban;
                            return (
                                <Card
                                    key={entry.iban}
                                    variant="elevated"
                                    padding="default"
                                >
                                    <Inline space="m" alignY="center">
                                        <button
                                            type="button"
                                            className={styles.ibanRow}
                                            onClick={() => handlePick(entry)}
                                        >
                                            <Inline space="m" alignY="center">
                                                <Box
                                                    className={
                                                        styles.cardIconBubble
                                                    }
                                                >
                                                    <TransferIcon
                                                        width={20}
                                                        height={20}
                                                    />
                                                </Box>
                                                <Box flexGrow={1}>
                                                    <Text
                                                        variant="body"
                                                        weight="semiBold"
                                                    >
                                                        {entry.name}
                                                    </Text>
                                                    <Text
                                                        variant="bodySmall"
                                                        color="secondary"
                                                    >
                                                        {maskIban(entry.iban)}
                                                    </Text>
                                                </Box>
                                                {isSelected ? (
                                                    <Box
                                                        color="success"
                                                        display="flex"
                                                        alignItems="center"
                                                    >
                                                        <CheckIcon
                                                            width={18}
                                                            height={18}
                                                        />
                                                    </Box>
                                                ) : null}
                                            </Inline>
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.linkButton}
                                            onClick={() =>
                                                removeIban(entry.iban)
                                            }
                                            aria-label={t(
                                                "monerium.bankFlow.transfer.ibanManager.remove"
                                            )}
                                        >
                                            <Box
                                                color="tertiary"
                                                display="flex"
                                                alignItems="center"
                                            >
                                                <CloseIcon
                                                    width={16}
                                                    height={16}
                                                />
                                            </Box>
                                        </button>
                                    </Inline>
                                </Card>
                            );
                        })}
                    </Stack>
                )}

                {/* Add new IBAN form */}
                <Stack space="s">
                    <Text variant="heading4">
                        {t("monerium.bankFlow.transfer.ibanManager.addNew")}
                    </Text>
                    <Stack space="xs">
                        <Text variant="label" color="secondary">
                            {t(
                                "monerium.bankFlow.transfer.ibanManager.nameLabel"
                            )}
                        </Text>
                        <Input
                            length="big"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t(
                                "monerium.bankFlow.transfer.ibanManager.namePlaceholder"
                            )}
                        />
                    </Stack>
                    <Stack space="xs">
                        <Text variant="label" color="secondary">
                            {t(
                                "monerium.bankFlow.transfer.ibanManager.ibanLabel"
                            )}
                        </Text>
                        <Input
                            length="big"
                            value={iban}
                            onChange={(e) => setIban(e.target.value)}
                            placeholder={t(
                                "monerium.bankFlow.transfer.ibanManager.ibanPlaceholder"
                            )}
                        />
                    </Stack>
                    <Button
                        variant="primary"
                        width="full"
                        size="medium"
                        onClick={handleSave}
                        disabled={!canSave}
                    >
                        {t("monerium.bankFlow.transfer.ibanManager.save")}
                    </Button>
                </Stack>
            </Stack>
        </MoneriumScreen>
    );
}
