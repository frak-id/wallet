import { Pencil } from "@/assets/icons/Pencil";
import { ButtonRippleSmall } from "@/module/common/component/ButtonRippleSmall";
import { InputRounded } from "@/module/common/component/InputRounded";
import { useCopyAddress } from "@/module/wallet/hook/useCopyAddress";
import { Copy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useConnectorClient } from "wagmi";
import styles from "./index.module.css";

type FormInput = {
    username: string;
};

export function ProfileForm() {
    const { data: connectorClient } = useConnectorClient();
    const [disabled, setDisabled] = useState(true);
    const { copied, copyAddress } = useCopyAddress();

    // Form control and validation
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormInput>();

    function onSubmit(data: FormInput) {
        console.log(data);
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className={styles.profileForm}>
            <p className={styles.profileForm__input}>
                <InputRounded
                    aria-label="Enter username"
                    placeholder="Enter username"
                    disabled={disabled}
                    aria-invalid={errors.username ? "true" : "false"}
                    defaultValue={"@moonflower12"}
                    {...register("username", {
                        required: "Username is required",
                        minLength: {
                            value: 3,
                            message: "Minimum username length is 3",
                        },
                    })}
                />
                <button
                    type={"button"}
                    className={"button"}
                    onClick={() => setDisabled(!disabled)}
                >
                    <Pencil />
                </button>
            </p>
            <p className={styles.profileForm__input}>
                <InputRounded
                    defaultValue={
                        copied ? "Copied!" : connectorClient?.account?.address
                    }
                    disabled={true}
                    variant={"transparent"}
                />
                <button
                    type={"button"}
                    className={"button"}
                    onClick={() =>
                        copyAddress(connectorClient?.account?.address as string)
                    }
                >
                    <Copy size={17} color={"#3F5279"} />
                </button>
            </p>
            {errors.username && (
                <p className={styles.profileForm__error}>
                    {errors.username.message}
                </p>
            )}
            <p>
                <ButtonRippleSmall type={"submit"}>confirm</ButtonRippleSmall>
            </p>
            <p>
                <Link href={"/"} className={styles.profileForm__link}>
                    later
                </Link>
            </p>
        </form>
    );
}
