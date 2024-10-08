import { Badge } from "@/module/common/component/Badge";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/module/common/component/Command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import { Separator } from "@/module/common/component/Separator";
import { Button } from "@module/component/Button";
import { Tooltip } from "@module/component/Tooltip";
import { CheckIcon, ChevronDown, X, XIcon } from "lucide-react";
import { forwardRef, useState } from "react";
import type { ButtonHTMLAttributes } from "react";
import styles from "./index.module.css";

type Option = {
    name: string;
    value?: string;
    tooltip?: string;
};

export interface MultiSelectProps
    extends ButtonHTMLAttributes<HTMLButtonElement> {
    options: Option[];
    onValueChange: (value: Option[]) => void;
    placeholder?: string;
    animation?: number;
    asChild?: boolean;
    className?: string;
}

export const MultiSelect = forwardRef<HTMLButtonElement, MultiSelectProps>(
    (
        {
            options,
            onValueChange,
            value,
            placeholder = "Select options",
            asChild = false,
            className,
            ...props
        },
        ref
    ) => {
        const namesFromValue = Array.isArray(value)
            ? value.map(
                  (v: string) =>
                      options.find((o) => (o.value ?? o.name) === v)?.name ?? v
              )
            : [];
        const selectedNames = new Set(namesFromValue);
        const [isPopoverOpen, setIsPopoverOpen] = useState(false);

        const toggleOption = (args: Option) => {
            const isSelected = selectedNames.has(args.name);
            if (isSelected) {
                selectedNames.delete(args.name);
            } else {
                selectedNames.add(args.name);
            }
            const filterValues = Array.from(selectedNames)
                .map((name) => options.find((o) => o.name === name))
                .filter((value) => value !== undefined);
            onValueChange(filterValues);
        };

        const handleClear = () => {
            onValueChange([]);
        };

        const handleTogglePopover = () => {
            setIsPopoverOpen((prev) => !prev);
        };

        return (
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant={"trigger"}
                        ref={ref}
                        {...props}
                        onClick={handleTogglePopover}
                        className={styles.multiSelect__trigger}
                    >
                        {selectedNames.size > 0 ? (
                            <SelectedValues
                                selectedValues={selectedNames}
                                options={options}
                                toggleOption={toggleOption}
                                handleClear={handleClear}
                            />
                        ) : (
                            <div className={styles.multiSelect__triggerInner}>
                                <span>{placeholder}</span>
                                <ChevronDown size={20} />
                            </div>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    onEscapeKeyDown={() => setIsPopoverOpen(false)}
                >
                    <Command>
                        <CommandInput placeholder="Search..." />
                        <CommandSeparator />
                        <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                <OptionsList
                                    selectedValues={selectedNames}
                                    options={options}
                                    toggleOption={toggleOption}
                                />
                            </CommandGroup>
                        </CommandList>
                        <CommandSeparator />
                        <CommandGroup>
                            <div className={styles.multiSelect__actions}>
                                {selectedNames.size > 0 && (
                                    <>
                                        <CommandItem
                                            onSelect={handleClear}
                                            className={
                                                styles.multiSelect__button
                                            }
                                        >
                                            Clear
                                        </CommandItem>
                                        <Separator
                                            orientation="vertical"
                                            className={
                                                styles.multiSelect__separator
                                            }
                                        />
                                    </>
                                )}
                                <CommandItem
                                    onSelect={() => setIsPopoverOpen(false)}
                                    className={styles.multiSelect__button}
                                >
                                    Close
                                </CommandItem>
                            </div>
                        </CommandGroup>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    }
);
MultiSelect.displayName = "MultiSelect";

/**
 * List of selected values
 * @param selectedValues
 * @param options
 * @param toggleOption
 * @param handleClear
 * @constructor
 */
function SelectedValues({
    selectedValues,
    options,
    toggleOption,
    handleClear,
}: {
    selectedValues: Set<string>;
    options: Option[];
    toggleOption: (args: Option) => void;
    handleClear: () => void;
}) {
    return (
        <div className={styles.multiSelect__triggerInner}>
            <div className={styles.multiSelect__triggerBadges}>
                {selectedValues.size > 2 && (
                    <SelectedValuesMore size={selectedValues.size} />
                )}
                {selectedValues.size <= 2 &&
                    options
                        .filter((option) => selectedValues.has(option.name))
                        .map((option) => (
                            <Badge
                                key={option.name}
                                variant={"information"}
                                className={styles.multiSelect__badge}
                            >
                                {option?.name}
                                <X
                                    size={14}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        if (!option) return;
                                        toggleOption(option);
                                    }}
                                />
                            </Badge>
                        ))}
            </div>
            <div className={styles.multiSelect__actions}>
                <XIcon
                    onClick={(event) => {
                        event.stopPropagation();
                        handleClear();
                    }}
                    size={20}
                />
                <Separator
                    orientation="vertical"
                    className={styles.multiSelect__triggerSeparator}
                />
                <ChevronDown size={20} />
            </div>
        </div>
    );
}

/**
 * When more than 2 selected values
 * @param size
 * @constructor
 */
function SelectedValuesMore({
    size,
}: {
    size: number;
}) {
    return (
        <div className={styles.multiSelect__triggerInner}>
            <div className={styles.multiSelect__triggerBadges}>
                <Badge
                    variant={"information"}
                    className={styles.multiSelect__badge}
                >
                    {size} selected
                </Badge>
            </div>
        </div>
    );
}

/**
 * List of all options
 * @param selectedValues
 * @param options
 * @param toggleOption
 * @constructor
 */
function OptionsList({
    selectedValues,
    options,
    toggleOption,
}: {
    selectedValues: Set<string>;
    options: Option[];
    toggleOption: (args: Option) => void;
}) {
    return options.map((option) => {
        const isSelected = selectedValues.has(option.name);
        return (
            <CommandItem
                key={option.name}
                onSelect={() => toggleOption(option)}
            >
                <div
                    className={`${styles.multiSelect__checks} ${
                        isSelected
                            ? styles["multiSelect__checks--selected"]
                            : styles["multiSelect__checks--notSelected"]
                    }`}
                >
                    <CheckIcon size={12} />
                </div>
                <Tooltip content={option.tooltip} hidden={!option.tooltip}>
                    <span>{option.name}</span>
                </Tooltip>
            </CommandItem>
        );
    });
}
