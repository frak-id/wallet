import type { RecipeVariants } from "@vanilla-extract/recipes";
import type {
    AnchorHTMLAttributes,
    ButtonHTMLAttributes,
    ReactNode,
    Ref,
} from "react";
import { Box } from "../Box";
import { Spinner } from "../Spinner";
import { button } from "./button.css";

type CommonButtonProps = RecipeVariants<typeof button> & {
    children: ReactNode;
    icon?: ReactNode;
    /** Show a spinner and disable the button */
    loading?: boolean;
};

type ButtonAsButton = ButtonHTMLAttributes<HTMLButtonElement> &
    CommonButtonProps & {
        as?: "button";
        ref?: Ref<HTMLButtonElement>;
    };

type ButtonAsAnchor = AnchorHTMLAttributes<HTMLAnchorElement> &
    CommonButtonProps & {
        as: "a";
        ref?: Ref<HTMLAnchorElement>;
    };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

export function Button(props: ButtonProps) {
    const {
        as = "button",
        variant,
        size,
        fontSize,
        width,
        children,
        icon,
        loading,
        className,
        color: _color,
        ref,
        ...rest
    } = props as ButtonAsButton & Partial<ButtonAsAnchor>;

    // `<a>` doesn't accept `type` or `disabled` — only apply them when we
    // render a real button so we don't emit invalid attributes on anchors.
    const buttonOnlyProps =
        as === "button"
            ? {
                  type:
                      (rest as ButtonHTMLAttributes<HTMLButtonElement>)
                          .type ?? ("button" as const),
                  disabled:
                      (rest as ButtonHTMLAttributes<HTMLButtonElement>)
                          .disabled || loading,
              }
            : {};

    return (
        <Box
            as={as}
            className={`${button({ variant, size, width, fontSize })}${className ? ` ${className}` : ""}`}
            ref={ref}
            {...rest}
            {...buttonOnlyProps}
        >
            {loading ? <Spinner size="s" /> : icon}
            {children}
        </Box>
    );
}
