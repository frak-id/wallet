import { Label } from "@/module/forms/Label";
import type * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva, cx } from "class-variance-authority";
import { createContext, forwardRef, useContext, useId } from "react";
import type {
    ComponentPropsWithoutRef,
    ComponentRef,
    HTMLAttributes,
    ReactNode,
} from "react";
import { Controller, FormProvider, useFormContext } from "react-hook-form";
import type { ControllerProps, FieldPath, FieldValues } from "react-hook-form";
import styles from "./index.module.css";

const Form = FormProvider;

function FormLayout({
    children,
    className,
}: { children: ReactNode; className?: string }) {
    return <div className={cx(styles.form__layout, className)}>{children}</div>;
}

type FormFieldContextValue<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
    name: TName;
};

const FormFieldContext = createContext<FormFieldContextValue>(
    {} as FormFieldContextValue
);

const FormField = <
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
    ...props
}: ControllerProps<TFieldValues, TName>) => {
    return (
        <FormFieldContext.Provider value={{ name: props.name }}>
            <Controller {...props} />
        </FormFieldContext.Provider>
    );
};

const useFormField = () => {
    const fieldContext = useContext(FormFieldContext);
    const itemContext = useContext(FormItemContext);
    const { getFieldState, formState } = useFormContext();

    const fieldState = getFieldState(fieldContext.name, formState);

    if (!fieldContext) {
        throw new Error("useFormField should be used within <FormField>");
    }

    const { id } = itemContext;

    return {
        id,
        name: fieldContext.name,
        formItemId: `${id}-form-item`,
        formDescriptionId: `${id}-form-item-description`,
        formMessageId: `${id}-form-item-message`,
        ...fieldState,
    };
};

type FormItemContextValue = {
    id: string;
};

const FormItemContext = createContext<FormItemContextValue>(
    {} as FormItemContextValue
);

export interface FormItemProps
    extends HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof formItemVariants> {}

export const formItemVariants = cva(styles.form__item, {
    variants: {
        variant: {
            radio: styles.form__radio,
            checkbox: styles.form__checkbox,
        },
    },
});

const FormItem = forwardRef<HTMLDivElement, FormItemProps>(
    ({ variant, className, ...props }, ref) => {
        const id = useId();

        return (
            <FormItemContext.Provider value={{ id }}>
                <div
                    ref={ref}
                    className={formItemVariants({ variant, className })}
                    {...props}
                />
            </FormItemContext.Provider>
        );
    }
);
FormItem.displayName = "FormItem";

export interface FormLabelProps
    extends ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
        VariantProps<typeof formLabelVariants> {}

export const formLabelVariants = cva(styles.form__label, {
    variants: {
        variant: {
            radio: styles.form__radioWithLabel,
            checkbox: styles.form__checkboxWithLabel,
            light: styles["form__label--light"],
            dark: styles["form__label--dark"],
        },
        selected: {
            true: styles["form__label--selected"],
        },
        weight: {
            medium: styles["form__label--medium"],
        },
    },
});

const FormLabel = forwardRef<
    ComponentRef<typeof LabelPrimitive.Root>,
    FormLabelProps
>(({ variant, selected, weight, className, ...props }, ref) => {
    const { error, formItemId } = useFormField();
    const classNameError = error ? styles.form__error : "";

    return (
        <Label
            ref={ref}
            className={`${formLabelVariants({
                variant,
                selected,
                weight,
                className,
            })} ${classNameError}`}
            htmlFor={formItemId}
            {...props}
        />
    );
});
FormLabel.displayName = "FormLabel";

const FormControl = forwardRef<
    ComponentRef<typeof Slot>,
    ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } =
        useFormField();

    return (
        <Slot
            ref={ref}
            id={formItemId}
            aria-describedby={
                !error
                    ? `${formDescriptionId}`
                    : `${formDescriptionId} ${formMessageId}`
            }
            aria-invalid={!!error}
            {...props}
        />
    );
});
FormControl.displayName = "FormControl";

export const formDescriptionVariants = cva(styles.form__description);

const FormDescription = forwardRef<
    HTMLParagraphElement,
    HTMLAttributes<HTMLParagraphElement> & {
        label?: string | ReactNode;
        classNameTitle?: string;
    }
>(({ label, classNameTitle = "", className = "", children, ...props }, ref) => {
    const { formDescriptionId } = useFormField();

    return (
        <>
            {label && (
                <h3 className={`${styles.form__title} ${classNameTitle}`}>
                    {label}
                </h3>
            )}
            <p
                ref={ref}
                id={formDescriptionId}
                className={formDescriptionVariants({ className })}
                {...props}
            >
                {children}
            </p>
        </>
    );
});
FormDescription.displayName = "FormDescription";

const FormMessage = forwardRef<
    HTMLParagraphElement,
    HTMLAttributes<HTMLParagraphElement>
>(({ className = "", children, ...props }, ref) => {
    const { error, formMessageId } = useFormField();
    const body = error ? String(error?.message) : children;

    if (!body) {
        return null;
    }

    return (
        <p
            ref={ref}
            id={formMessageId}
            className={`error ${className}`}
            {...props}
        >
            {body}
        </p>
    );
});
FormMessage.displayName = "FormMessage";

const FormValidMessage = forwardRef<
    HTMLParagraphElement,
    HTMLAttributes<HTMLParagraphElement>
>(({ className = "", children, ...props }, ref) => {
    const { formMessageId, invalid, error } = useFormField();

    if (invalid || !!error) {
        return null;
    }

    return (
        <p
            ref={ref}
            id={`${formMessageId}-valid`}
            className={`success ${className}`}
            {...props}
        >
            {children}
        </p>
    );
});
FormValidMessage.displayName = "FormValidMessage";

export {
    useFormField,
    Form,
    FormLayout,
    FormItem,
    FormLabel,
    FormControl,
    FormDescription,
    FormMessage,
    FormValidMessage,
    FormField,
};
