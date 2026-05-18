import type * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import clsx from "clsx";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { createContext, useContext, useId } from "react";
import type { ControllerProps, FieldPath, FieldValues } from "react-hook-form";
import { Controller, FormProvider, useFormContext } from "react-hook-form";
import { Label } from "@/module/forms/Label";
import {
    formDescription,
    formError,
    formItem,
    formLabel,
    formLayout,
    formTitle,
} from "./form.css";

const Form = FormProvider;

function FormLayout({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return <div className={clsx(formLayout, className)}>{children}</div>;
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

type FormItemRecipeVariants = NonNullable<RecipeVariants<typeof formItem>>;

export type FormItemProps = ComponentPropsWithRef<"div"> &
    FormItemRecipeVariants;

const FormItem = ({ ref, variant, className, ...props }: FormItemProps) => {
    const id = useId();

    return (
        <FormItemContext.Provider value={{ id }}>
            <div
                ref={ref}
                className={clsx(formItem({ variant }), className)}
                {...props}
            />
        </FormItemContext.Provider>
    );
};
FormItem.displayName = "FormItem";

type FormLabelRecipeVariants = NonNullable<RecipeVariants<typeof formLabel>>;

export type FormLabelProps = ComponentPropsWithRef<typeof LabelPrimitive.Root> &
    FormLabelRecipeVariants;

const FormLabel = ({
    ref,
    variant,
    selected,
    weight,
    className,
    ...props
}: FormLabelProps) => {
    const { error, formItemId } = useFormField();
    return (
        <Label
            ref={ref}
            className={clsx(
                formLabel({ variant, selected, weight }),
                className,
                error && formError
            )}
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

export type FormDescriptionProps = ComponentPropsWithRef<"p"> & {
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
                <h3 className={clsx(formTitle, classNameTitle)}>{label}</h3>
            )}
            <p
                ref={ref}
                id={formDescriptionId}
                className={clsx(formDescription, className)}
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
            className={clsx("error", className)}
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
            className={clsx("success", className)}
            {...props}
        >
            {children}
        </p>
    );
};
FormValidMessage.displayName = "FormValidMessage";

export {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormLayout,
    FormMessage,
    FormValidMessage,
};
