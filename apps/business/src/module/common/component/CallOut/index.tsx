import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { ComponentPropsWithRef } from "react";
import { callOutVariants } from "./call-out.css";

type CallOutRecipeVariants = NonNullable<
    RecipeVariants<typeof callOutVariants>
>;

export type CallOutProps = ComponentPropsWithRef<"p"> & CallOutRecipeVariants;

export const CallOut = ({
    ref,
    className,
    variant,
    ...props
}: CallOutProps) => {
    return (
        <p
            className={`${callOutVariants({
                variant,
            })}${className ? ` ${className}` : ""}`}
            ref={ref}
            {...props}
        />
    );
};

CallOut.displayName = "CallOut";
