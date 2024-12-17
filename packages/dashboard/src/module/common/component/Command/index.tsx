"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

const Command = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof CommandPrimitive>) => (
    <CommandPrimitive
        ref={ref}
        className={`${styles.command} ${className}`}
        {...props}
    />
);
Command.displayName = CommandPrimitive.displayName;

const CommandInput = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.Input>) => (
    <div className={styles.command__inputWrapper}>
        <Search size={16} />
        <CommandPrimitive.Input
            ref={ref}
            className={`${styles.command__input} ${className}`}
            {...props}
        />
    </div>
);

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.List>) => (
    <CommandPrimitive.List
        ref={ref}
        className={`${styles.command__list} ${className}`}
        {...props}
    />
);

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = ({
    ref,
    ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.Empty>) => (
    <CommandPrimitive.Empty
        ref={ref}
        className={styles.command__empty}
        {...props}
    />
);

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.Group>) => (
    <CommandPrimitive.Group
        ref={ref}
        className={`${styles.command__group} ${className}`}
        {...props}
    />
);

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.Separator>) => (
    <CommandPrimitive.Separator
        ref={ref}
        className={`${styles.command__separator} ${className}`}
        {...props}
    />
);
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.Item>) => (
    <CommandPrimitive.Item
        ref={ref}
        className={`${styles.command__item} ${className}`}
        {...props}
    />
);

CommandItem.displayName = CommandPrimitive.Item.displayName;

export {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator,
};
