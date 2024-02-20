import { Pencil } from "@/assets/icons/Pencil";
import { Input } from "@/module/common/component/Input";
import { Check } from "lucide-react";
import { type FormEvent, useState } from "react";
import styles from "./index.module.css";

export function AccountName({
    username,
    setUsername,
    setShowAccountName,
    disabled,
}: {
    username?: string;
    setUsername: (value: string) => void;
    setShowAccountName: (value: boolean) => void;
    disabled?: boolean;
}) {
    const [showForm, setShowForm] = useState(false);
    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
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
                <form onSubmit={onSubmit}>
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
                                name={"walletName"}
                                id={"walletName"}
                                aria-label="Your wallet name"
                                placeholder="Enter your wallet name"
                                value={username}
                                onChangeValue={(value) =>
                                    setUsername(value ?? "")
                                }
                            />
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
