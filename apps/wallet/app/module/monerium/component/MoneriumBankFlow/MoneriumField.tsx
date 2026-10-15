import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import type { ComponentProps } from "react";
import { useId } from "react";
import { FieldError, FieldLabel } from "@/module/common/component/Field";

type MoneriumFieldProps = Omit<
    ComponentProps<typeof Input>,
    "variant" | "length" | "error" | "aria-label"
> & {
    label: string;
    /** Shown under the field, which turns red, while set. */
    errorMessage?: string;
};

/** Labelled bare input with an inline, screen-reader-announced error. */
export function MoneriumField({
    label,
    errorMessage,
    ...inputProps
}: MoneriumFieldProps) {
    const errorId = useId();

    return (
        <Stack space="xs">
            <FieldLabel>{label}</FieldLabel>
            <Input
                {...inputProps}
                variant="bare"
                length="big"
                aria-label={label}
                error={Boolean(errorMessage)}
                aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? errorId : undefined}
            />
            {errorMessage ? (
                <div id={errorId} role="alert">
                    <FieldError>{errorMessage}</FieldError>
                </div>
            ) : null}
        </Stack>
    );
}
