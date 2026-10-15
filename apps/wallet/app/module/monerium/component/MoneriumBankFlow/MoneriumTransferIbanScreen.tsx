import { MONERIUM_LIMITS } from "@frak-labs/app-essentials/monerium";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
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
import {
    getIbanFormErrors,
    type IbanFormField,
    resolveCountry,
    toIbanEntry,
} from "@/module/monerium/utils/ibanForm";
import * as styles from "./index.css";
import { MoneriumCountrySelect } from "./MoneriumCountrySelect";
import { MoneriumField } from "./MoneriumField";
import { MoneriumSavedIbanList } from "./MoneriumSavedIbanList";
import { MoneriumScreen } from "./MoneriumScreen";

const IBAN_KEY = "monerium.bankFlow.transfer.ibanManager";

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
    const currentIban = (currentOverride ?? effectiveIban)?.iban ?? null;

    const [own, setOwn] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [iban, setIban] = useState("");
    const [country, setCountry] = useState("");
    const [pseudo, setPseudo] = useState("");
    // The label follows the names until the user types their own.
    const [pseudoTouched, setPseudoTouched] = useState(false);
    const [touched, setTouched] = useState<Set<IbanFormField>>(new Set());

    const values = { own, iban, firstName, lastName, country };
    const errors = getIbanFormErrors(values);
    const derivedPseudo = own
        ? t(`${IBAN_KEY}.ownAccountLabel`)
        : `${firstName.trim()} ${lastName.trim()}`.trim();
    const effectivePseudo = pseudoTouched ? pseudo : derivedPseudo;
    const canSave = errors.length === 0 && effectivePseudo.trim().length > 0;

    const markTouched = (field: IbanFormField) =>
        setTouched((previous) => new Set(previous).add(field));
    const hasError = (field: IbanFormField) =>
        errors.includes(field) &&
        (touched.has(field) || (field === "iban" && iban.trim() !== ""));
    const nameError = t(`${IBAN_KEY}.nameInvalid`, {
        min: MONERIUM_LIMITS.NAME_MIN_LENGTH,
    });

    function handleSelect(entry: IbanEntry) {
        setLastUsedIban(entry.iban);
        setSelectedIban(entry);
        goTo("transfer-amount");
    }

    function handleSave() {
        if (!canSave) return;
        const entry = toIbanEntry(values, effectivePseudo.trim());
        addIban(entry);
        handleSelect(entry);
    }

    return (
        <MoneriumScreen
            onClose={() => goTo("transfer-amount")}
            leftIcon="back"
            title={t(`${IBAN_KEY}.title`)}
            ctaLabel={t(`${IBAN_KEY}.save`)}
            ctaOnClick={handleSave}
            ctaDisabled={!canSave}
        >
            <MoneriumSavedIbanList
                entries={knownIbans}
                selectedIban={currentIban}
                onSelect={handleSelect}
                onRemove={removeIban}
            />

            <Stack space="m">
                <Text variant="heading4">{t(`${IBAN_KEY}.addNew`)}</Text>

                <Card variant="elevated" padding="none">
                    <Inline
                        space="m"
                        alignY="center"
                        align="space-between"
                        wrap={false}
                        className={styles.transferCellPadding}
                    >
                        <Stack space="xxs">
                            <Text variant="body" weight="medium">
                                {t(`${IBAN_KEY}.ownToggle`)}
                            </Text>
                            <Text variant="bodySmall" color="secondary">
                                {t(`${IBAN_KEY}.ownToggleDescription`)}
                            </Text>
                        </Stack>
                        <Switch
                            aria-label={t(`${IBAN_KEY}.ownToggle`)}
                            checked={own}
                            onCheckedChange={setOwn}
                        />
                    </Inline>
                </Card>

                <MoneriumField
                    label={t(`${IBAN_KEY}.ibanLabel`)}
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    onBlur={() => markTouched("iban")}
                    errorMessage={
                        hasError("iban")
                            ? t(`${IBAN_KEY}.ibanInvalid`)
                            : undefined
                    }
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={t(`${IBAN_KEY}.ibanPlaceholder`)}
                />

                {own ? null : (
                    <>
                        <MoneriumField
                            label={t(`${IBAN_KEY}.firstNameLabel`)}
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            onBlur={() => markTouched("firstName")}
                            errorMessage={
                                hasError("firstName") ? nameError : undefined
                            }
                            placeholder={t(`${IBAN_KEY}.firstNamePlaceholder`)}
                        />
                        <MoneriumField
                            label={t(`${IBAN_KEY}.lastNameLabel`)}
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            onBlur={() => markTouched("lastName")}
                            errorMessage={
                                hasError("lastName") ? nameError : undefined
                            }
                            placeholder={t(`${IBAN_KEY}.lastNamePlaceholder`)}
                        />
                        <MoneriumCountrySelect
                            value={resolveCountry(values)}
                            onChange={(code) => {
                                setCountry(code);
                                markTouched("country");
                            }}
                            invalid={hasError("country")}
                        />
                    </>
                )}

                <MoneriumField
                    label={t(`${IBAN_KEY}.pseudoLabel`)}
                    value={effectivePseudo}
                    onChange={(e) => {
                        setPseudoTouched(true);
                        setPseudo(e.target.value);
                    }}
                    placeholder={t(`${IBAN_KEY}.pseudoPlaceholder`)}
                />
            </Stack>
        </MoneriumScreen>
    );
}
