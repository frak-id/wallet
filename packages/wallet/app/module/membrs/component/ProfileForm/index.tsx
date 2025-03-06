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
    const session = useAtomValue(sessionAtom);
    const [isUsernameDisabled, setIsUsernameDisabled] = useState(true);
    const [submitError, setSubmitError] = useState<string>();

    // State management with Jotai atoms
    const [user, setUser] = useAtom(userAtom);
    const [profilePhoto, setProfilePhoto] = useAtom(uploadProfilePhotoAtom);

    // Form setup and validation
    const formMethods = useForm<FormInput>({
        defaultValues: {
            username: user?.username ?? "Enter username",
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
            setSubmitError(
                "An error occurred while saving your profile. Please try again."
            );
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
    return (
        <p className={styles.profileForm__input}>
            <Input
                aria-label="Enter username"
                placeholder="Enter username"
                disabled={isDisabled}
                aria-invalid={errors.username ? "true" : "false"}
                {...register("username", {
                    required: "Username is required",
                    minLength: {
                        value: 3,
                        message: "Minimum username length is 3",
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
    const { copied, copy } = useCopyToClipboardWithState();

    return (
        <p className={styles.profileForm__input}>
            <Input value={copied ? "Copied!" : address} disabled={true} />
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
    return (
        <p className={styles.profileForm__submit}>
            <Button type="submit" disabled={isDisabled}>
                confirm
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
                later
            </button>
        </p>
    );
}
