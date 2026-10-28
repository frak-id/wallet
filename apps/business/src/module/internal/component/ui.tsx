import { Card } from "@frak-labs/design-system/components/Card";
import { FieldLabel } from "@frak-labs/design-system/components/FieldLabel";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Notice } from "@frak-labs/design-system/components/Notice";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    type ChangeEvent,
    type ComponentProps,
    type ReactNode,
    useId,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { ConfirmDialog } from "@/module/common/component/ConfirmDialog";
import { DetailRow, DetailValue } from "@/module/common/component/DetailRow";
import { errorMessage } from "../format";

type PendingAction = { isPending: boolean; error: unknown };

export function ErrorNotice({
    error,
    tone = "error",
}: {
    error: unknown;
    tone?: "error" | "warning";
}) {
    const { t } = useTranslation();
    if (!error) return null;
    return (
        <Notice tone={tone} role="alert">
            {errorMessage(error, t)}
        </Notice>
    );
}

/** The internal page's card: a heading with an optional badge, description and actions. */
export function Panel({
    title,
    badge,
    description,
    actions,
    children,
}: {
    title?: ReactNode;
    badge?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <Card radius="m">
            <Stack space="m">
                <Spread space="m">
                    <Stack space="xxs">
                        {title && (
                            <Inline space="s" alignY="center">
                                <Text as="h2" variant="heading4">
                                    {title}
                                </Text>
                                {badge}
                            </Inline>
                        )}
                        {description && (
                            <Text variant="bodySmall" color="secondary">
                                {description}
                            </Text>
                        )}
                    </Stack>
                    {actions}
                </Spread>
                {children}
            </Stack>
        </Card>
    );
}

export function Details({ rows }: { rows: [label: string, ReactNode][] }) {
    return (
        <Stack space="none">
            {rows.map(([label, value]) => (
                <DetailRow key={label} label={label}>
                    <DetailValue>{value}</DetailValue>
                </DetailRow>
            ))}
        </Stack>
    );
}

/** A button that asks first, then runs `mutation` and closes once it succeeds. */
export function ConfirmAction<TVariables>({
    trigger,
    title,
    description,
    confirmLabel,
    destructive,
    mutation,
    variables,
}: {
    trigger: ReactNode;
    title: ReactNode;
    description: ReactNode;
    confirmLabel: ReactNode;
    destructive?: boolean;
    mutation: PendingAction & {
        mutate: (
            variables: TVariables,
            options: { onSuccess: () => void }
        ) => void;
    };
    variables: TVariables;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    return (
        <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            trigger={trigger}
            title={title}
            description={description}
            cancelLabel={t("common.cancel")}
            confirmLabel={confirmLabel}
            confirmTone={destructive ? "destructive" : "primary"}
            isConfirming={mutation.isPending}
            error={<ErrorNotice error={mutation.error} />}
            onConfirm={() =>
                mutation.mutate(variables, { onSuccess: () => setOpen(false) })
            }
        />
    );
}

/** String form state, with `bind(key)` spreading `value`/`onChange` onto an input. */
export function useFields<T extends Record<string, string>>(initial: () => T) {
    const [values, setValues] = useState(initial);
    const set = (key: keyof T) => (value: string) =>
        setValues((current) => ({ ...current, [key]: value }));
    const bind = (key: keyof T) => ({
        value: values[key],
        onChange: (event: ChangeEvent<HTMLInputElement>) =>
            set(key)(event.target.value),
    });
    return { values, set, bind };
}

export function ActionForm({
    onSubmit,
    children,
}: {
    onSubmit: () => void;
    children: ReactNode;
}) {
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
            }}
        >
            <Stack space="m">{children}</Stack>
        </form>
    );
}

/** The error, the 2FA hint for money moves, then cancel and submit. */
export function FormActions({
    mutation,
    submitLabel,
    stepUp,
    disabled,
    onCancel,
}: {
    mutation: PendingAction;
    submitLabel: ReactNode;
    stepUp?: boolean;
    disabled?: boolean;
    onCancel?: () => void;
}) {
    const { t } = useTranslation();
    return (
        <>
            <ErrorNotice error={mutation.error} />
            {stepUp && (
                <Text variant="caption" color="tertiary">
                    {t("internal.form.stepUpHint")}
                </Text>
            )}
            <Inline space="s">
                {onCancel && (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                    >
                        {t("common.cancel")}
                    </Button>
                )}
                <Button
                    type="submit"
                    disabled={disabled}
                    loading={mutation.isPending}
                >
                    {submitLabel}
                </Button>
            </Inline>
        </>
    );
}

export function AmountInput(props: ComponentProps<typeof Input>) {
    return (
        <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            required
            {...props}
        />
    );
}

/** A select over `options`; `labelHidden` keeps the label for screen readers only. */
export function OptionSelect<TValue extends string>({
    label,
    labelHidden,
    value,
    onChange,
    options,
    placeholder,
}: {
    label: string;
    labelHidden?: boolean;
    value: TValue;
    onChange: (value: TValue) => void;
    options: { value: TValue; label: ReactNode }[];
    placeholder?: string;
}) {
    const id = useId();
    const select = (
        <Select
            value={value}
            onValueChange={(next) => onChange(next as TValue)}
        >
            <SelectTrigger id={id} aria-label={label}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
    if (labelHidden) return select;
    return (
        <FieldLabel label={label} htmlFor={id}>
            {select}
        </FieldLabel>
    );
}
