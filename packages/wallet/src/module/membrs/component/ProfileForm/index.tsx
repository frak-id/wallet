import { Pencil } from "@/assets/icons/Pencil";
import { saveUser } from "@/context/membrs/action/user";
import { ButtonRippleSmall } from "@/module/common/component/ButtonRippleSmall";
import { InputRounded } from "@/module/common/component/InputRounded";
import { uploadProfilePhotoAtom } from "@/module/membrs/atoms/uploadProfilePhoto";
import { userAtom } from "@/module/membrs/atoms/user";
import { useCopyAddress } from "@/module/wallet/hook/useCopyAddress";
import { useAtom } from "jotai";
import { Copy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useConnectorClient } from "wagmi";
import styles from "./index.module.css";

type FormInput = {
    username: string;
    photo: string;
};

export function ProfileForm() {
    const { data: connectorClient } = useConnectorClient();
    const [disabled, setDisabled] = useState(true);
    const [error, setError] = useState<string>();
    const { copied, copyAddress } = useCopyAddress();

    // Get the user from the atom
    const [user, setUser] = useAtom(userAtom);

    // Get the profile photo from the avatar upload
    const [profilePhoto, setProfilePhoto] = useAtom(uploadProfilePhotoAtom);

    /**
     * Set the uploaded profile photo in the form
     */
    useEffect(() => {
        if (!profilePhoto) return;
        setValue("photo", profilePhoto, {
            shouldDirty: true,
        });
    }, [profilePhoto]);

    // Form control and validation
    const {
        register,
        handleSubmit,
        formState: { errors, isDirty },
        setValue,
        reset,
    } = useForm<FormInput>({
        defaultValues: {
            username: user?.username ?? "Enter username",
            photo: user?.photo ?? undefined,
        },
    });

    async function onSubmit({ username }: FormInput) {
        setError(undefined);
        setDisabled(true);
        if (!connectorClient?.account?.address) return;

        const newUser = {
            _id: connectorClient?.account?.address,
            username,
            photo: profilePhoto ?? user?.photo ?? undefined,
        };

        // Save the user in the database
        try {
            await saveUser(newUser);
        } catch (error) {
            console.error(error);
            setError(
                "An error occurred while saving your profile. Please try again."
            );
            return;
        }

        // Update the user in the atom
        setUser(newUser);

        // Reset the profile photo upload
        setProfilePhoto(undefined);

        // Reset the form with the new user
        reset(newUser);
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className={styles.profileForm}>
            <p className={styles.profileForm__input}>
                <InputRounded
                    aria-label="Enter username"
                    placeholder="Enter username"
                    disabled={disabled}
                    aria-invalid={errors.username ? "true" : "false"}
                    {...register("username", {
                        required: "Username is required",
                        minLength: {
                            value: 3,
                            message: "Minimum username length is 3",
                        },
                    })}
                />
                <input type="hidden" {...register("photo")} />
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
                <ButtonRippleSmall type={"submit"} disabled={!isDirty}>
                    confirm
                </ButtonRippleSmall>
            </p>
            {error && <p className={"error"}>{error}</p>}
            <p>
                <Link href={"/"} className={styles.profileForm__link}>
                    later
                </Link>
            </p>
        </form>
    );
}
