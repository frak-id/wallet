import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/configStore";
import styles from "./CustomizationSubForm.module.css";
import { type CssFormData, cssFormSchema } from "./schemas";

export function CssCustomization() {
    const config = useConfigStore((state) => state.config);
    const updateCustomizations = useConfigStore(
        (state) => state.updateCustomizations
    );

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<CssFormData>({
        resolver: zodResolver(cssFormSchema),
        defaultValues: {
            css: config.customizations.css || "",
        },
    });

    const onSubmit = (data: CssFormData) => {
        updateCustomizations({ css: data.css });
        toast.success("Customization CSS settings saved");
    };

    return (
        <div className={styles.container}>
            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
                <div className={styles.formField}>
                    <label htmlFor="css" className={styles.label}>
                        CSS
                    </label>
                    <input
                        id="css"
                        type="text"
                        className={styles.input}
                        {...register("css")}
                    />
                    {errors.css && (
                        <span className={styles.error}>
                            {errors.css.message}
                        </span>
                    )}
                    <p className={styles.description}>
                        Custom CSS styles to apply to the modals and components
                        (<strong>optional</strong>).
                    </p>
                </div>

                <button type="submit" className={styles.submitButton}>
                    Submit
                </button>
            </form>
        </div>
    );
}
