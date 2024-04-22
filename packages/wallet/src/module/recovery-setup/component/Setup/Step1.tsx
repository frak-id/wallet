import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Input } from "@/module/common/component/Input";
import { AccordionRecoveryItem } from "@/module/recovery-setup/component/AccordionItem";
import { getStatusCurrentStep } from "@/module/recovery-setup/component/Setup";
import {
    recoveryPasswordAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { useAtom, useSetAtom } from "jotai";
import { type SubmitHandler, useForm } from "react-hook-form";
import styles from "./Step1.module.css";

type FormInput = {
    password: string;
};

const ACTUAL_STEP = 1;

export function Step1() {
    // Get or set the current step
    const [step, setStep] = useAtom(recoveryStepAtom);

    // Set the password for recovery
    const setPassword = useSetAtom(recoveryPasswordAtom);

    // Form control and validation
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormInput>();

    // Submit handler that handles the form password submission
    const onSubmit: SubmitHandler<FormInput> = async ({ password }) => {
        setPassword(password);
        setStep(ACTUAL_STEP + 1);
    };

    return (
        <AccordionRecoveryItem
            item={`step-${ACTUAL_STEP}`}
            trigger={<span>{ACTUAL_STEP}. Encryption password</span>}
            status={getStatusCurrentStep(ACTUAL_STEP, step)}
        >
            <form onSubmit={handleSubmit(onSubmit)}>
                <p>
                    <label htmlFor="password">Please enter a password</label>
                    <Input
                        type={"password"}
                        id={"password"}
                        aria-label="Enter password"
                        placeholder="Enter password"
                        classNameWrapper={styles.step1__input}
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
                        <span className={styles.step1__error}>
                            {errors.password.message}
                        </span>
                    )}
                    <ButtonRipple type={"submit"}>Submit</ButtonRipple>
                </p>
            </form>
        </AccordionRecoveryItem>
    );
}
