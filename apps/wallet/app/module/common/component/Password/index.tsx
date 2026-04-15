import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Input } from "@frak-labs/design-system/components/Input";
import { Text } from "@frak-labs/design-system/components/Text";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

type FormInput = {
    password: string;
};

export function Password({ onSubmit }: { onSubmit: SubmitHandler<FormInput> }) {
    const { t } = useTranslation();
    const [isVisible, setIsVisible] = useState(false);
    // Form control and validation
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormInput>();

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <Box as="p" className={styles.formBlock}>
                <Box as="label" htmlFor="password">
                    <Text as="span" variant="label">
                        {t("wallet.password.pleaseEnter")}
                    </Text>
                </Box>
                <Input
                    type={isVisible ? "text" : "password"}
                    id="password"
                    aria-label={t("wallet.password.enter")}
                    placeholder={t("wallet.password.enter")}
                    className={styles.input}
                    aria-invalid={errors.password ? "true" : "false"}
                    error={Boolean(errors.password)}
                    rightSection={
                        <Box
                            as="button"
                            type="button"
                            className={styles.toggleButton}
                            onClick={() => setIsVisible((prev) => !prev)}
                            aria-label="Toggle password visibility"
                        >
                            {isVisible ? (
                                <EyeOff size={16} />
                            ) : (
                                <Eye size={16} />
                            )}
                        </Box>
                    }
                    {...register("password", {
                        required: t("wallet.password.required"),
                        minLength: {
                            value: 5,
                            message: t("wallet.password.minimum"),
                        },
                    })}
                />
                {errors.password && (
                    <Text as="span" className={styles.errorText}>
                        {errors.password.message}
                    </Text>
                )}
                <Button type="submit">{t("common.submit")}</Button>
            </Box>
        </form>
    );
}
