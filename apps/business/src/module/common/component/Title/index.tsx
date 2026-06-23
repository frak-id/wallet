import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import clsx from "clsx";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { titleText } from "./title.css";

type TitleSize = "small" | "medium" | "big";
type TitleTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

const sizeToVariant = {
    small: "body",
    medium: "heading4",
    big: "heading2",
} as const;

export type TitleProps = Omit<
    ComponentPropsWithRef<"h1">,
    "color" | "width" | "height"
> & {
    as?: TitleTag;
    size?: TitleSize;
    icon?: ReactNode;
    className?: string;
    classNameText?: string;
    children?: string | ReactNode;
};

export const Title = ({
    ref,
    as = "h2",
    size = "small",
    icon,
    className,
    classNameText,
    children,
    ...props
}: TitleProps) => (
    <Box
        as={as}
        display="flex"
        alignItems="center"
        gap="s"
        className={className}
        ref={ref}
        {...props}
    >
        {icon && (
            <Box as="span" display="flex">
                {icon}
            </Box>
        )}
        <Text
            as="span"
            variant={sizeToVariant[size]}
            weight={size === "small" ? "medium" : undefined}
            className={clsx(titleText, classNameText)}
        >
            {children}
        </Text>
    </Box>
);

Title.displayName = "Title";
