import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon } from "@frak-labs/design-system/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FieldLabel } from "@/module/common/component/Field";
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

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [iban, setIban] = useState("");
    const [pseudo, setPseudo] = useState("");
    // Track whether the user has explicitly typed in the pseudo input —
    // we only auto-default it from `${firstName} ${lastName}` while it's
    // pristine, otherwise we'd clobber their custom value.
    const [pseudoTouched, setPseudoTouched] = useState(false);

    const derivedPseudo = `${firstName.trim()} ${lastName.trim()}`.trim();
    const effectivePseudo = pseudoTouched ? pseudo : derivedPseudo;

    const canSave =
        firstName.trim().length > 0 &&
        lastName.trim().length > 0 &&
        effectivePseudo.length > 0 &&
        isValidIbanFormat(iban);

    function handleSelect(entry: IbanEntry) {
        setLastUsedIban(entry.iban);
        setSelectedIban(entry);
        goTo("transfer-amount");
    }

    function handleSave() {
        if (!canSave) return;
        const trimmed: IbanEntry = {
            iban: iban.replace(/\s/g, "").toUpperCase(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            pseudo: effectivePseudo,
        };
        addIban(trimmed);
        setLastUsedIban(trimmed.iban);
        setFirstName("");
        setLastName("");
        setIban("");
        setPseudo("");
        setPseudoTouched(false);
        handleSelect(trimmed);
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
                                                {entry.pseudo}
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
                    <FieldLabel>
                        {t(
                            "monerium.bankFlow.transfer.ibanManager.firstNameLabel"
                        )}
                    </FieldLabel>
                    <Input
                        variant="bare"
                        length="big"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder={t(
                            "monerium.bankFlow.transfer.ibanManager.firstNamePlaceholder"
                        )}
                        aria-label={t(
                            "monerium.bankFlow.transfer.ibanManager.firstNameLabel"
                        )}
                    />
                </Stack>

                <Stack space="xs">
                    <FieldLabel>
                        {t(
                            "monerium.bankFlow.transfer.ibanManager.lastNameLabel"
                        )}
                    </FieldLabel>
                    <Input
                        variant="bare"
                        length="big"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder={t(
                            "monerium.bankFlow.transfer.ibanManager.lastNamePlaceholder"
                        )}
                        aria-label={t(
                            "monerium.bankFlow.transfer.ibanManager.lastNameLabel"
                        )}
                    />
                </Stack>

                <Stack space="xs">
                    <FieldLabel>
                        {t("monerium.bankFlow.transfer.ibanManager.ibanLabel")}
                    </FieldLabel>
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

                <Stack space="xs">
                    <FieldLabel>
                        {t(
                            "monerium.bankFlow.transfer.ibanManager.pseudoLabel"
                        )}
                    </FieldLabel>
                    <Input
                        variant="bare"
                        length="big"
                        value={effectivePseudo}
                        onChange={(e) => {
                            setPseudoTouched(true);
                            setPseudo(e.target.value);
                        }}
                        placeholder={t(
                            "monerium.bankFlow.transfer.ibanManager.pseudoPlaceholder"
                        )}
                        aria-label={t(
                            "monerium.bankFlow.transfer.ibanManager.pseudoLabel"
                        )}
                    />
                </Stack>
            </Stack>
        </MoneriumScreen>
    );
}
