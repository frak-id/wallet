import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { type ComponentProps, useId } from "react";

type LabelledInputProps = Omit<
    ComponentProps<typeof Input>,
    "variant" | "length" | "error" | "label"
> & {
    label: string;
    /** Shown under the field, which turns red, while set. */
    errorMessage?: string;
};

/** Labelled bare input with an inline, screen-reader-announced error. */
export function LabelledInput({
    errorMessage,
    ...inputProps
}: LabelledInputProps) {
    const errorId = useId();

    return (
        <Stack space="xs">
            <Input
                {...inputProps}
                variant="bare"
                length="big"
                error={Boolean(errorMessage)}
                aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? errorId : undefined}
            />
            <FieldError id={errorId} role="alert">
                {errorMessage}
            </FieldError>
        </Stack>
    );
}
