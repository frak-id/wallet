import { Badge } from "@/module/common/component/Badge";
import { Button } from "@/module/common/component/Button";
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
import { CheckIcon, ChevronDown, X, XIcon } from "lucide-react";
import { forwardRef, useEffect, useState } from "react";
import type { ButtonHTMLAttributes, KeyboardEvent } from "react";
import styles from "./index.module.css";

interface MultiSelectProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    options: {
        name: string;
    }[];
    onValueChange: (value: string[]) => void;
    defaultValue?: string[];
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
            defaultValue = [],
            placeholder = "Select options",
            asChild = false,
            className,
            ...props
        },
        ref
    ) => {
        const [selectedValues, setSelectedValues] =
            useState<string[]>(defaultValue);
        const [isPopoverOpen, setIsPopoverOpen] = useState(false);

        useEffect(() => {
            if (defaultValue.length > 0) {
                setSelectedValues(defaultValue);
            }
        }, [defaultValue]);

        const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter") {
                setIsPopoverOpen(true);
            } else if (
                event.key === "Backspace" &&
                !event.currentTarget.value
            ) {
                const newSelectedValues = [...selectedValues];
                newSelectedValues.pop();
                setSelectedValues(newSelectedValues);
                onValueChange(newSelectedValues);
            }
        };

        const toggleOption = (value: string) => {
            const newSelectedValues = selectedValues.includes(value)
                ? selectedValues.filter((v) => v !== value)
                : [...selectedValues, value];
            setSelectedValues(newSelectedValues);
            onValueChange(newSelectedValues);
        };

        const handleClear = () => {
            setSelectedValues([]);
            onValueChange([]);
        };

        const handleTogglePopover = () => {
            setIsPopoverOpen((prev) => !prev);
        };

        return (
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                        ref={ref}
                        {...props}
                        onClick={handleTogglePopover}
                        className={styles.multiSelect__trigger}
                    >
                        {selectedValues.length > 0 ? (
                            <SelectedValues
                                selectedValues={selectedValues}
                                options={options}
                                toggleOption={toggleOption}
                                handleClear={handleClear}
                            />
                        ) : (
                            <div className={styles.multiSelect__triggerInner}>
                                {placeholder}
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
                        <CommandInput
                            placeholder="Search..."
                            onKeyDown={handleInputKeyDown}
                        />
                        <CommandSeparator />
                        <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                <OptionsList
                                    selectedValues={selectedValues}
                                    options={options}
                                    toggleOption={toggleOption}
                                />
                            </CommandGroup>
                        </CommandList>
                        <CommandSeparator />
                        <CommandGroup>
                            <div className={styles.multiSelect__actions}>
                                {selectedValues.length > 0 && (
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

function SelectedValues({
    selectedValues,
    options,
    toggleOption,
    handleClear,
}: {
    selectedValues: string[];
    options: {
        name: string;
    }[];
    toggleOption: (value: string) => void;
    handleClear: () => void;
}) {
    return (
        <div className={styles.multiSelect__triggerInner}>
            <div className={styles.multiSelect__triggerBadges}>
                {selectedValues.map((value) => {
                    const option = options.find((o) => o.name === value);
                    return (
                        <Badge
                            key={value}
                            variant={"information"}
                            className={styles.multiSelect__badge}
                        >
                            {option?.name}
                            <X
                                size={16}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    toggleOption(value);
                                }}
                            />
                        </Badge>
                    );
                })}
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

function OptionsList({
    selectedValues,
    options,
    toggleOption,
}: {
    selectedValues: string[];
    options: {
        name: string;
    }[];
    toggleOption: (value: string) => void;
}) {
    return (
        <>
            {options.map((option) => {
                const isSelected = selectedValues.includes(option.name);
                return (
                    <CommandItem
                        key={option.name}
                        onSelect={() => toggleOption(option.name)}
                        className="cursor-pointer"
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
                        <span>{option.name}</span>
                    </CommandItem>
                );
            })}
        </>
    );
}
