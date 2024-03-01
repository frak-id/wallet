import { Pencil } from "@/assets/icons/Pencil";
import { Input } from "@/module/common/component/Input";
import { Check } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";
import styles from "./index.module.css";

type FormInput = {
    walletName: string;
};

export function AccountName({
    setUsername,
    setShowAccountName,
    disabled,
}: {
    setUsername: (value: string | undefined) => void;
    setShowAccountName: (value: boolean) => void;
    disabled?: boolean;
}) {
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormInput>();
    const [showForm, setShowForm] = useState(false);
    const onSubmit: SubmitHandler<FormInput> = (data) => {
        setUsername(data.walletName !== "" ? data.walletName : undefined);
        setShowForm(!showForm);
        setShowAccountName(!showForm);
    };

    return (
        <div className={styles.accountName}>
            {!showForm && (
                <button
                    type={"button"}
                    disabled={disabled}
                    className={`button ${styles.accountName__triggerButton}`}
                    onClick={() => {
                        setShowForm(!showForm);
                        setShowAccountName(!showForm);
                    }}
                >
                    <Pencil color={disabled ? "#7C7B8C" : undefined} />
                    Customise my Nexus account
                </button>
            )}
            {showForm && (
                <form onSubmit={handleSubmit(onSubmit)}>
                    <p>
                        <label
                            htmlFor="walletName"
                            className={styles.accountName__label}
                        >
                            Wallet name<sup>**</sup>
                        </label>
                        <span className={styles.accountName__input}>
                            <Input
                                type={"text"}
                                disabled={disabled}
                                id={"walletName"}
                                aria-label="Your wallet name"
                                placeholder="Enter your wallet name"
                                {...register("walletName")}
                            />
                            {errors.walletName && (
                                <span className={"error"}>
                                    {errors.walletName.message}
                                </span>
                            )}
                            <button
                                type={"submit"}
                                disabled={disabled}
                                className={`button ${styles.accountName__button}`}
                            >
                                <Check size={24} />
                            </button>
                        </span>
                    </p>
                </form>
            )}
        </div>
    );
}
