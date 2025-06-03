import { Button } from "@shared/module/component/Button";
import { Input } from "@shared/module/component/forms/Input";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

type FormInput = {
    password: string;
};

export function Password({ onSubmit }: { onSubmit: SubmitHandler<FormInput> }) {
    const { t } = useTranslation();
    // Form control and validation
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormInput>();

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <p>
                <label htmlFor="password">
                    {t("wallet.password.pleaseEnter")}
                </label>
                <Input
                    type={"password"}
                    id={"password"}
                    aria-label={t("wallet.password.enter")}
                    placeholder={t("wallet.password.enter")}
                    classNameWrapper={styles.password__input}
                    aria-invalid={errors.password ? "true" : "false"}
                    {...register("password", {
                        required: t("wallet.password.required"),
                        minLength: {
                            value: 5,
                            message: t("wallet.password.minimum"),
                        },
                    })}
                />
                {errors.password && (
                    <span className={styles.password__error}>
                        {errors.password.message}
                    </span>
                )}
                <Button type={"submit"} width={"full"}>
                    {t("common.submit")}
                </Button>
            </p>
        </form>
    );
}
