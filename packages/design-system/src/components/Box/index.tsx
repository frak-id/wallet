import type { AllHTMLAttributes, CSSProperties, ReactNode, Ref } from "react";
import { createElement } from "react";

import { base, element } from "@/reset.css";
import type { Sprinkles } from "@/sprinkles.css";
import { sprinkles } from "@/sprinkles.css";

type BoxElement =
    | "div"
    | "ul"
    | "ol"
    | "li"
    | "section"
    | "nav"
    | "span"
    | "header"
    | "footer"
    | "main"
    | "aside"
    | "article"
    | "details"
    | "button"
    | "a"
    | "form"
    | "fieldset"
    | "label"
    | "table"
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6"
    | "p"
    | "input"
    | "textarea"
    | "select";

type BoxHTMLProps = Omit<
    AllHTMLAttributes<HTMLElement>,
    "width" | "height" | "color" | "className"
>;

type BoxProps = Sprinkles &
    BoxHTMLProps & {
        as?: BoxElement;
        children?: ReactNode;
        className?: string;
        style?: CSSProperties;
        ref?: Ref<HTMLElement>;
    };

export function Box({
    as: Tag = "div",
    className,
    ref,
    children,
    style,
    ...rest
}: BoxProps) {
    const atomProps: Record<string, unknown> = {};
    const nativeProps: Record<string, unknown> = {};

    for (const key in rest) {
        if (sprinkles.properties.has(key as keyof Sprinkles)) {
            atomProps[key] = rest[key as keyof typeof rest];
        } else {
            nativeProps[key] = rest[key as keyof typeof rest];
        }
    }

    const elementReset = element[Tag as keyof typeof element];
    const resetClass = elementReset ? `${base} ${elementReset}` : base;
    const sprinklesClass = sprinkles(atomProps as Sprinkles);
    const combinedClassName = [resetClass, sprinklesClass, className]
        .filter(Boolean)
        .join(" ");

    return createElement(
        Tag,
        {
            className: combinedClassName,
            style,
            ref,
            ...(nativeProps as AllHTMLAttributes<HTMLElement>),
        },
        children
    );
}
