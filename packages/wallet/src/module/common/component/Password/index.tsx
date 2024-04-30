import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Input } from "@/module/common/component/Input";
import { type SubmitHandler, useForm } from "react-hook-form";
import styles from "./index.module.css";

type FormInput = {
    password: string;
};

export function Password({ onSubmit }: { onSubmit: SubmitHandler<FormInput> }) {
    // Form control and validation
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormInput>();

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <p>
                <label htmlFor="password">Please enter a password</label>
                <Input
                    type={"password"}
                    id={"password"}
                    aria-label="Enter password"
                    placeholder="Enter password"
                    classNameWrapper={styles.password__input}
                    aria-invalid={errors.password ? "true" : "false"}
                    {...register("password", {
                        required: "Password is required",
                        minLength: {
                            value: 5,
                            message: "Minimum password length is 5",
                        },
                    })}
                />
                {errors.password && (
                    <span className={styles.password__error}>
                        {errors.password.message}
                    </span>
                )}
                <ButtonRipple type={"submit"}>Submit</ButtonRipple>
            </p>
        </form>
    );
}
