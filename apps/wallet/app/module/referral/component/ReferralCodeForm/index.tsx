import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CheckCircleFilledIcon,
    CloseIcon,
} from "@frak-labs/design-system/icons";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

const CODE_PATTERN = /^[a-zA-Z]{4}$/;

type FormInput = {
    code: string;
};

export function ReferralCodeForm() {
    const { t } = useTranslation();

    const { register, handleSubmit, watch, setValue } = useForm<FormInput>({
        mode: "onChange",
        defaultValues: { code: "" },
    });

    const code = watch("code") ?? "";
    const hasValue = code.length > 0;
    const isValid = CODE_PATTERN.test(code);

    return (
        <form
            onSubmit={handleSubmit(() => {
                // TODO: persist code and navigate to next referral step
            })}
        >
            <Stack space="xs">
                <Box className={styles.labelRow}>
                    <Text
                        as="label"
                        variant="bodySmall"
                        weight="medium"
                        color="secondary"
                    >
                        {t("wallet.referral.create.label")}
                    </Text>
                </Box>
                <Input
                    variant="bare"
                    length="big"
                    aria-label={t("wallet.referral.create.label")}
                    placeholder={t("wallet.referral.create.placeholder")}
                    maxLength={4}
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    rightSection={
                        hasValue ? (
                            <Box
                                as="button"
                                type="button"
                                aria-label={t("common.clear")}
                                className={styles.clearButton}
                                onClick={() =>
                                    setValue("code", "", {
                                        shouldValidate: true,
                                    })
                                }
                            >
                                <CloseIcon />
                            </Box>
                        ) : undefined
                    }
                    {...register("code", {
                        pattern: CODE_PATTERN,
                    })}
                />
                <Box className={styles.hintRow}>
                    <Inline space="xxs" alignY="center">
                        {isValid ? (
                            <CheckCircleFilledIcon
                                width={12}
                                height={12}
                                className={styles.checkIcon}
                            />
                        ) : null}
                        <Text variant="caption" color="tertiary">
                            {t("wallet.referral.create.hint")}
                        </Text>
                    </Inline>
                </Box>
                <Button
                    type="submit"
                    variant="primary"
                    size="large"
                    width="full"
                    disabled={!isValid}
                >
                    {t("wallet.referral.invite.cta")}
                </Button>
            </Stack>
        </form>
    );
}
