import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon } from "@frak-labs/design-system/icons";
import {
    type ChangeEvent,
    type ReactNode,
    useCallback,
    useId,
    useState,
} from "react";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { isValidEmail } from "@/module/common/utils/email";
import * as styles from "./index.css";

export type EmailFormScreenProps = {
    title: string;
    description: string;
    label: string;
    placeholder: string;
    clearAriaLabel: string;
    submitLabel: string;
    initialValue?: string;
    onBack: () => void;
    /**
     * Called with the trimmed email when the form is submitted with a valid
     * value. May be async; the caller surfaces its loading state via
     * `isSubmitting`.
     */
    onSubmit: (email: string) => void | Promise<void>;
    isSubmitting?: boolean;
    /**
     * Extra disabling beyond `!isValid || isSubmitting`. Used to block submit
     * while a transient banner (already-used / conflict) is shown for the
     * current value.
     */
    submitDisabled?: boolean;
    /** Called on every input change. Lets parents drop transient banners. */
    onEmailChange?: (email: string) => void;
    /**
     * Slot rendered after the input. Hosts state-specific UI:
     * already-used banner (onboarding), conflict banner (post-auth),
     * inline error messages from the mutation, etc.
     */
    children?: ReactNode;
};

/**
 * Shared screen scaffold for the wallet's "enter an email" flows.
 *
 * Owns the input state, validity check, and form/page layout so the two
 * callers (onboarding `EmailInputStep`, post-auth `AddEmail`) only need to
 * supply their copy, their mutation handler, and any banner / error UI as
 * children.
 */
export function EmailFormScreen({
    title,
    description,
    label,
    placeholder,
    clearAriaLabel,
    submitLabel,
    initialValue = "",
    onBack,
    onSubmit,
    isSubmitting = false,
    submitDisabled = false,
    onEmailChange,
    children,
}: EmailFormScreenProps) {
    const [email, setEmail] = useState(initialValue);
    const formId = useId();

    const trimmed = email.trim();
    const hasValue = trimmed.length > 0;
    const isValid = isValidEmail(trimmed);
    const disabled = !isValid || isSubmitting || submitDisabled;

    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setEmail(event.target.value);
            onEmailChange?.(event.target.value);
        },
        [onEmailChange]
    );

    const handleClear = useCallback(() => {
        setEmail("");
        onEmailChange?.("");
    }, [onEmailChange]);

    const handleSubmit = useCallback(() => {
        if (!isValid || isSubmitting) return;
        void onSubmit(trimmed);
    }, [isValid, isSubmitting, onSubmit, trimmed]);

    return (
        <PageLayout
            fixedViewport
            back={<Back onClick={onBack} />}
            footer={
                <Button
                    type="submit"
                    form={formId}
                    variant="primary"
                    size="large"
                    width="full"
                    disabled={disabled}
                    loading={isSubmitting}
                >
                    {submitLabel}
                </Button>
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">{title}</Title>
                    <Text variant="body" color="secondary">
                        {description}
                    </Text>
                </Stack>

                <form
                    id={formId}
                    onSubmit={(event) => {
                        event.preventDefault();
                        handleSubmit();
                    }}
                >
                    <Stack space="xs">
                        <Box className={styles.labelRow}>
                            <Text
                                as="label"
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                            >
                                {label}
                            </Text>
                        </Box>
                        <Input
                            variant="bare"
                            tone="muted"
                            length="big"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            enterKeyHint="go"
                            autoFocus
                            aria-label={label}
                            placeholder={placeholder}
                            value={email}
                            onChange={handleChange}
                            rightSection={
                                hasValue ? (
                                    <Box
                                        as="button"
                                        type="button"
                                        aria-label={clearAriaLabel}
                                        className={styles.clearButton}
                                        onClick={handleClear}
                                    >
                                        <CloseIcon />
                                    </Box>
                                ) : undefined
                            }
                        />
                    </Stack>
                </form>

                {children}
            </Stack>
        </PageLayout>
    );
}

export { styles as emailFormScreenStyles };
