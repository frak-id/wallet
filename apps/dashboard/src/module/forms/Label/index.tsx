"use client";

import { Root } from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

const labelVariants = cva(styles.label);

const Label = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof Root> & VariantProps<typeof labelVariants>) => (
    <Root ref={ref} className={labelVariants({ className })} {...props} />
);
Label.displayName = Root.displayName;

export { Label };
