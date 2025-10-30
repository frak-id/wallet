import type * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import { cva, cx, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { createContext, useContext, useId } from "react";
import type { ControllerProps, FieldPath, FieldValues } from "react-hook-form";
import { Controller, FormProvider, useFormContext } from "react-hook-form";
import { Label } from "@/module/forms/Label";
import styles from "./index.module.css";

const Form = FormProvider;

function FormLayout({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
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

export type FormItemProps = ComponentPropsWithRef<"div"> &
    VariantProps<typeof formItemVariants>;

export const formItemVariants = cva(styles.form__item, {
    variants: {
        variant: {
            radio: styles.form__radio,
            checkbox: styles.form__checkbox,
        },
    },
});

const FormItem = ({ ref, variant, className, ...props }: FormItemProps) => {
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
};
FormItem.displayName = "FormItem";

export type FormLabelProps = ComponentPropsWithRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof formLabelVariants>;

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

const FormLabel = ({
    ref,
    variant,
    selected,
    weight,
    className,
    ...props
}: FormLabelProps) => {
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
};
FormLabel.displayName = "FormLabel";

const FormControl = ({ ref, ...props }: ComponentPropsWithRef<typeof Slot>) => {
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
};
FormControl.displayName = "FormControl";

export const formDescriptionVariants = cva(styles.form__description);

export type FormDescriptionProps = ComponentPropsWithRef<"p"> &
    VariantProps<typeof formDescriptionVariants> & {
        label?: string | ReactNode;
        classNameTitle?: string;
    };

const FormDescription = ({
    ref,
    label,
    classNameTitle = "",
    className = "",
    children,
    ...props
}: FormDescriptionProps) => {
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
};
FormDescription.displayName = "FormDescription";

const FormMessage = ({
    ref,
    className = "",
    children,
    ...props
}: ComponentPropsWithRef<"p">) => {
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
};
FormMessage.displayName = "FormMessage";

const FormValidMessage = ({
    ref,
    className = "",
    children,
    ...props
}: ComponentPropsWithRef<"p">) => {
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
};
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
