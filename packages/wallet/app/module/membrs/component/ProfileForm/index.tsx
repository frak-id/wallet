import { sessionAtom } from "@/module/common/atoms/session";
import type { User } from "@/types/User";
import { Pencil } from "@shared/module/asset/icons/Pencil";
import { Button } from "@shared/module/component/Button";
import { Input } from "@shared/module/component/forms/Input";
import { useCopyToClipboardWithState } from "@shared/module/hook/useCopyToClipboardWithState";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import {
    type FieldErrors,
    type SubmitHandler,
    type UseFormReturn,
    useForm,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { uploadProfilePhotoAtom } from "../../atoms/uploadProfilePhoto";
import { userAtom, userSetupLaterAtom } from "../../atoms/user";
import styles from "./index.module.css";

// Types
type FormInput = {
    username: string;
    photo: string;
};

/**
 * Profile form component for user profile management
 */
export function ProfileForm() {
    const { t } = useTranslation();
    const session = useAtomValue(sessionAtom);
    const [isUsernameDisabled, setIsUsernameDisabled] = useState(true);
    const [submitError, setSubmitError] = useState<string>();

    // State management with Jotai atoms
    const [user, setUser] = useAtom(userAtom);
    const [profilePhoto, setProfilePhoto] = useAtom(uploadProfilePhotoAtom);

    // Form setup and validation
    const formMethods = useForm<FormInput>({
        defaultValues: {
            username: user?.username ?? t("wallet.membrs.profile.form.name"),
            photo: user?.photo ?? undefined,
        },
    });

    const {
        register,
        handleSubmit,
        formState: { errors, isDirty },
        setValue,
        reset,
    } = formMethods;

    // Update form when profile photo changes
    useEffect(() => {
        if (!profilePhoto) return;
        setValue("photo", profilePhoto, { shouldDirty: true });
    }, [profilePhoto, setValue]);

    const onSubmit: SubmitHandler<FormInput> = async ({ username }) => {
        setSubmitError(undefined);
        setIsUsernameDisabled(true);

        if (!session?.address) return;

        const updatedUser: User = {
            _id: session.address,
            username,
            photo: profilePhoto ?? user?.photo,
        };

        try {
            // Commented out for now as per original code
            // await saveUser(updatedUser);

            // Update local state
            setUser(updatedUser);
            setProfilePhoto(undefined);
            reset(updatedUser);
        } catch (error) {
            console.error(error);
            setSubmitError(t("wallet.membrs.profile.form.error"));
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className={styles.profileForm}>
            <UsernameField
                register={register}
                errors={errors}
                isDisabled={isUsernameDisabled}
                onToggleEdit={() => setIsUsernameDisabled(!isUsernameDisabled)}
            />

            <input type="hidden" {...register("photo")} />

            <AddressField address={session?.address} />

            {errors.username && (
                <p className={styles.profileForm__error}>
                    {errors.username.message}
                </p>
            )}

            <SubmitButton isDisabled={!isDirty} />

            {submitError && <ErrorMessage message={submitError} />}

            {!user && <SetupLaterButton />}
        </form>
    );
}

type UsernameFieldProps = {
    register: UseFormReturn<FormInput>["register"];
    errors: FieldErrors<FormInput>;
    isDisabled: boolean;
    onToggleEdit: () => void;
};

/**
 * Username input field with edit button
 */
function UsernameField({
    register,
    errors,
    isDisabled,
    onToggleEdit,
}: UsernameFieldProps) {
    const { t } = useTranslation();

    return (
        <p className={styles.profileForm__input}>
            <Input
                aria-label={t("wallet.membrs.profile.form.name")}
                placeholder={t("wallet.membrs.profile.form.name")}
                disabled={isDisabled}
                aria-invalid={errors.username ? "true" : "false"}
                {...register("username", {
                    required: t("wallet.membrs.profile.form.nameRequired"),
                    minLength: {
                        value: 3,
                        message: t("wallet.membrs.profile.form.nameLength"),
                    },
                })}
            />
            <button type="button" className="button" onClick={onToggleEdit}>
                <Pencil />
            </button>
        </p>
    );
}

type AddressFieldProps = {
    address?: string;
};

/**
 * Wallet address field with copy button
 */
function AddressField({ address }: AddressFieldProps) {
    const { t } = useTranslation();
    const { copied, copy } = useCopyToClipboardWithState();

    return (
        <p className={styles.profileForm__input}>
            <Input
                value={copied ? t("common.copied") : address}
                disabled={true}
            />
            <button
                type="button"
                className="button"
                onClick={() => address && copy(address)}
            >
                <Copy size={17} color="#12244b" />
            </button>
        </p>
    );
}

type SubmitButtonProps = {
    isDisabled: boolean;
};

/**
 * Form submit button
 */
function SubmitButton({ isDisabled }: SubmitButtonProps) {
    const { t } = useTranslation();

    return (
        <p className={styles.profileForm__submit}>
            <Button type="submit" disabled={isDisabled}>
                {t("wallet.membrs.profile.form.button")}
            </Button>
        </p>
    );
}

type ErrorMessageProps = {
    message: string;
};

/**
 * Error message display
 */
function ErrorMessage({ message }: ErrorMessageProps) {
    return <p className="error">{message}</p>;
}

/**
 * Button to skip profile setup
 */
function SetupLaterButton() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const setUserSetupLater = useSetAtom(userSetupLaterAtom);

    return (
        <p>
            <button
                type="button"
                onClick={() => {
                    setUserSetupLater(true);
                    navigate("/membrs", { viewTransition: true });
                }}
                className={`button ${styles.profileForm__link}`}
            >
                {t("wallet.membrs.profile.form.later")}
            </button>
        </p>
    );
}
