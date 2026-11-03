import {
    isMoneriumOwnPayoutAvailable,
    MONERIUM_LIMITS,
} from "@frak-labs/app-essentials/monerium";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LabelledInput } from "@/module/common/component/LabelledInput";
import { useMoneriumStatus } from "@/module/monerium/hooks/useMoneriumStatus";
import {
    type IbanEntry,
    ibanStore,
    selectEffectiveIban,
    selectKnownIbans,
} from "@/module/monerium/store/ibanStore";
import { moneriumFlowStore } from "@/module/monerium/store/moneriumFlowStore";
import {
    getIbanFormErrors,
    type IbanFormField,
    type IbanFormValues,
    resolveCountry,
    toIbanEntry,
} from "@/module/monerium/utils/ibanForm";
import { MoneriumCountrySelect } from "./MoneriumCountrySelect";
import { MoneriumSavedIbanList } from "./MoneriumSavedIbanList";
import { MoneriumScreen } from "./MoneriumScreen";

const IBAN_KEY = "monerium.bankFlow.transfer.ibanManager";

const emptyForm: IbanFormValues = {
    own: false,
    iban: "",
    firstName: "",
    lastName: "",
    country: "",
};

export function MoneriumTransferIbanScreen() {
    const { t } = useTranslation();
    const knownIbans = ibanStore(selectKnownIbans);
    const addIban = ibanStore((s) => s.addIban);
    const removeIban = ibanStore((s) => s.removeIban);
    const setLastUsedIban = ibanStore((s) => s.setLastUsedIban);

    const goTo = moneriumFlowStore((s) => s.goTo);
    const currentIban = ibanStore(selectEffectiveIban)?.iban ?? null;

    const { status } = useMoneriumStatus();
    const canPayOwn = isMoneriumOwnPayoutAvailable(status?.profile?.state);
    const [form, setForm] = useState(emptyForm);
    // Null while the label follows the names, until the user types their own.
    const [pseudo, setPseudo] = useState<string | null>(null);
    const [touched, setTouched] = useState<Set<IbanFormField>>(new Set());

    const set =
        <K extends keyof IbanFormValues>(field: K) =>
        (value: IbanFormValues[K]) =>
            setForm((previous) => ({ ...previous, [field]: value }));
    const values = { ...form, own: canPayOwn && form.own };
    const errors = getIbanFormErrors(values);
    const derivedPseudo = values.own
        ? t(`${IBAN_KEY}.ownAccountLabel`)
        : `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const effectivePseudo = pseudo ?? derivedPseudo;
    const canSave = errors.length === 0 && effectivePseudo.trim().length > 0;

    const markTouched = (field: IbanFormField) =>
        setTouched((previous) => new Set(previous).add(field));
    const hasError = (field: IbanFormField) =>
        errors.includes(field) && touched.has(field);
    const nameError = t(`${IBAN_KEY}.nameInvalid`, {
        min: MONERIUM_LIMITS.NAME_MIN_LENGTH,
    });

    function handleSelect(entry: IbanEntry) {
        setLastUsedIban(entry.iban);
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

                {canPayOwn ? (
                    <Card variant="elevated" padding="cell">
                        <Inline
                            space="m"
                            alignY="center"
                            align="space-between"
                            wrap={false}
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
                                checked={values.own}
                                onCheckedChange={set("own")}
                            />
                        </Inline>
                    </Card>
                ) : null}

                <LabelledInput
                    label={t(`${IBAN_KEY}.ibanLabel`)}
                    value={form.iban}
                    onChange={(e) => set("iban")(e.target.value)}
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

                {values.own ? null : (
                    <>
                        <LabelledInput
                            label={t(`${IBAN_KEY}.firstNameLabel`)}
                            value={form.firstName}
                            onChange={(e) => set("firstName")(e.target.value)}
                            onBlur={() => markTouched("firstName")}
                            errorMessage={
                                hasError("firstName") ? nameError : undefined
                            }
                            placeholder={t(`${IBAN_KEY}.firstNamePlaceholder`)}
                        />
                        <LabelledInput
                            label={t(`${IBAN_KEY}.lastNameLabel`)}
                            value={form.lastName}
                            onChange={(e) => set("lastName")(e.target.value)}
                            onBlur={() => markTouched("lastName")}
                            errorMessage={
                                hasError("lastName") ? nameError : undefined
                            }
                            placeholder={t(`${IBAN_KEY}.lastNamePlaceholder`)}
                        />
                        <MoneriumCountrySelect
                            value={resolveCountry(values)}
                            onChange={set("country")}
                        />
                    </>
                )}

                <LabelledInput
                    label={t(`${IBAN_KEY}.pseudoLabel`)}
                    value={effectivePseudo}
                    onChange={(e) => setPseudo(e.target.value)}
                    placeholder={t(`${IBAN_KEY}.pseudoPlaceholder`)}
                />
            </Stack>
        </MoneriumScreen>
    );
}
