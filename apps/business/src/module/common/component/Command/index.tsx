import clsx from "clsx";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import {
    command,
    commandEmpty,
    commandGroup,
    commandInput,
    commandInputWrapper,
    commandItem,
    commandList,
    commandSeparator,
} from "./command.css";

const Command = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof CommandPrimitive>) => (
    <CommandPrimitive
        ref={ref}
        className={clsx(command, className)}
        {...props}
    />
);
Command.displayName = CommandPrimitive.displayName;

const CommandInput = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.Input>) => (
    <div className={commandInputWrapper}>
        <Search size={16} />
        <CommandPrimitive.Input
            ref={ref}
            className={clsx(commandInput, className)}
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
        className={clsx(commandList, className)}
        {...props}
    />
);

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = ({
    ref,
    ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.Empty>) => (
    <CommandPrimitive.Empty ref={ref} className={commandEmpty} {...props} />
);

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.Group>) => (
    <CommandPrimitive.Group
        ref={ref}
        className={clsx(commandGroup, className)}
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
        className={clsx(commandSeparator, className)}
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
        className={clsx(commandItem, className)}
        {...props}
    />
);

CommandItem.displayName = CommandPrimitive.Item.displayName;

export {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
};
