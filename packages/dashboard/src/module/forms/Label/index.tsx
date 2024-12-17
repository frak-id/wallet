"use client";

import { Root } from "@radix-ui/react-label";
import { type VariantProps, cva } from "class-variance-authority";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ComponentRef } from "react";
import styles from "./index.module.css";

const labelVariants = cva(styles.label);

const Label = forwardRef<
    ComponentRef<typeof Root>,
    ComponentPropsWithoutRef<typeof Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
    <Root ref={ref} className={labelVariants({ className })} {...props} />
));
Label.displayName = Root.displayName;

export { Label };
