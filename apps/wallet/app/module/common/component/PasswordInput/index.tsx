import { Box } from "@frak-labs/design-system/components/Box";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordInputProps = {
    value: string;
    onChange: (value: string) => void;
    /** Accessible label for the reveal/hide toggle. */
    toggleLabel: string;
    /** Optional field label rendered above the input. */
    label?: string;
    /** Optional helper text rendered below the input. */
    hint?: string;
    placeholder?: string;
    /** Defaults to `new-password` (creation). Pass `off` for verification fields. */
    autoComplete?: string;
    error?: boolean;
};

/**
 * Bare password field with an inline reveal toggle. Centralises the
 * `Input + eye toggle` pattern so password entry stays consistent (and the
 * toggle isn't re-implemented per screen).
 */
export function PasswordInput({
    value,
    onChange,
    toggleLabel,
    label,
    hint,
    placeholder,
    autoComplete = "new-password",
    error,
}: PasswordInputProps) {
    const [visible, setVisible] = useState(false);

    return (
        <Stack space="xs">
            {label ? (
                <Text
                    as="label"
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                >
                    {label}
                </Text>
            ) : null}
            <Input
                type={visible ? "text" : "password"}
                variant="bare"
                tone="muted"
                length="big"
                autoComplete={autoComplete}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={placeholder}
                value={value}
                error={error}
                onChange={(event) => onChange(event.target.value)}
                rightSection={
                    <Box
                        as="button"
                        type="button"
                        aria-label={toggleLabel}
                        onClick={() => setVisible((prev) => !prev)}
                    >
                        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Box>
                }
            />
            {hint ? (
                <Text variant="caption" color="tertiary">
                    {hint}
                </Text>
            ) : null}
        </Stack>
    );
}
