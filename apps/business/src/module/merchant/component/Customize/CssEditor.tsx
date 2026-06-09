import { FormActions } from "@/module/forms/FormActions";
import * as styles from "./customize.css";

export function CssEditor({
    value,
    onChange,
    placeholder,
    isPending,
    isSuccess,
    isDirty,
    onSave,
    onDiscard,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    isPending: boolean;
    isSuccess: boolean;
    isDirty: boolean;
    onSave: () => void;
    onDiscard: () => void;
}) {
    return (
        <>
            <textarea
                className={styles.customizeTextarea}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
            />
            <FormActions
                isSuccess={isSuccess}
                isPending={isPending}
                isDirty={isDirty}
                onDiscard={onDiscard}
                onSubmit={onSave}
            />
        </>
    );
}
