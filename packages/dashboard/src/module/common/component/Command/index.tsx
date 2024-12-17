"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ComponentRef } from "react";
import styles from "./index.module.css";

const Command = forwardRef<
    ComponentRef<typeof CommandPrimitive>,
    ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
    <CommandPrimitive
        ref={ref}
        className={`${styles.command} ${className}`}
        {...props}
    />
));
Command.displayName = CommandPrimitive.displayName;

const CommandInput = forwardRef<
    ComponentRef<typeof CommandPrimitive.Input>,
    ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
    <div className={styles.command__inputWrapper}>
        <Search size={16} />
        <CommandPrimitive.Input
            ref={ref}
            className={`${styles.command__input} ${className}`}
            {...props}
        />
    </div>
));

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = forwardRef<
    ComponentRef<typeof CommandPrimitive.List>,
    ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.List
        ref={ref}
        className={`${styles.command__list} ${className}`}
        {...props}
    />
));

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = forwardRef<
    ComponentRef<typeof CommandPrimitive.Empty>,
    ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
    <CommandPrimitive.Empty
        ref={ref}
        className={styles.command__empty}
        {...props}
    />
));

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = forwardRef<
    ComponentRef<typeof CommandPrimitive.Group>,
    ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.Group
        ref={ref}
        className={`${styles.command__group} ${className}`}
        {...props}
    />
));

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = forwardRef<
    ComponentRef<typeof CommandPrimitive.Separator>,
    ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.Separator
        ref={ref}
        className={`${styles.command__separator} ${className}`}
        {...props}
    />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = forwardRef<
    ComponentRef<typeof CommandPrimitive.Item>,
    ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.Item
        ref={ref}
        className={`${styles.command__item} ${className}`}
        {...props}
    />
));

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
