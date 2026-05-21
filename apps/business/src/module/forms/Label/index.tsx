import { Root } from "@radix-ui/react-label";
import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";
import { label } from "./label.css";

const Label = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof Root>) => (
    <Root ref={ref} className={clsx(label, className)} {...props} />
);
Label.displayName = Root.displayName;

export { Label };
