"use client";

import type { GetMembersParam } from "@/context/members/action/getProductMembers";
import { Row } from "@/module/common/component/Row";
import { Form } from "@/module/forms/Form";
import { tableMembersFiltersCountAtom } from "@/module/members/atoms/tableMembers";
import { InteractionsFiltering } from "@/module/members/component/MembersFiltering/InteractionsFiltering";
import { MembershipDateFiltering } from "@/module/members/component/MembersFiltering/MembershipDateFiltering";
import { ProductFiltering } from "@/module/members/component/MembersFiltering/ProductFiltering";
import { RewardFiltering } from "@/module/members/component/MembersFiltering/RewardFiltering";
import { Button } from "@module/component/Button";
import { useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { type Hex, formatEther, parseEther, toHex } from "viem";

/**
 * Filter for the members fetching process
 */
export type FormMembersFiltering = GetMembersParam["filter"] & {};

/**
 * Members filtering
 */
export function MembersFiltering({
    onFilterSet,
    initialValue,
    disabled,
    showResetButton,
}: {
    onFilterSet: (filter: FormMembersFiltering) => void;
    initialValue?: FormMembersFiltering;
    disabled?: boolean;
    showResetButton?: boolean;
}) {
    const setFiltersDirtyCount = useSetAtom(tableMembersFiltersCountAtom);

    // Map the initial values if any
    const mappedInitialValue = useMemo(() => {
        if (!initialValue?.rewards) return initialValue;

        // Map min and mnax rewards if present
        const { min, max } = initialValue.rewards;
        return {
            ...initialValue,
            // Type nonsense since min and max are treated as strings in the form, but string representing float, and we output hex string representing ether values
            rewards: {
                min: min ? (formatEther(BigInt(min as Hex)) as Hex) : undefined,
                max: max ? (formatEther(BigInt(max as Hex)) as Hex) : undefined,
            },
        };
    }, [initialValue]);

    const form = useForm<FormMembersFiltering>({
        values: mappedInitialValue,
        defaultValues: {},
        disabled,
    });

    function resetForm() {
        const defaultValues = {
            productIds: undefined,
            interactions: undefined,
            firstInteractionTimestamp: undefined,
            rewards: undefined,
        };
        form.reset(defaultValues);
        onFilterSet(defaultValues);
        setFiltersDirtyCount(0);
    }

    const onSubmit = useCallback(
        async (data: FormMembersFiltering) => {
            const allValues = filterOutUndefined(form.getValues());
            setFiltersDirtyCount(allValues.length);

            // Fix rewards min and max if needed
            if (data.rewards) {
                const { min, max } = data.rewards;
                if (min) {
                    data.rewards.min = toHex(parseEther(min));
                }
                if (max) {
                    data.rewards.max = toHex(parseEther(max));
                }
                if (!(min || max)) {
                    data.rewards = undefined;
                }
            }

            // Fix interactions if no filter provided
            if (!(data.interactions?.min || data.interactions?.max)) {
                data.interactions = undefined;
            }

            // Fix productIds if no filter provided
            if (!data.productIds?.length) {
                data.productIds = undefined;
            }

            onFilterSet(data);
        },
        [onFilterSet, form.getValues, setFiltersDirtyCount]
    );

    return (
        <Form {...form}>
            <ProductFiltering />
            <MembershipDateFiltering />
            <InteractionsFiltering />
            <RewardFiltering />

            <Row>
                {!disabled && (
                    <Button
                        type={"button"}
                        variant={"secondary"}
                        onClick={form.handleSubmit(onSubmit)}
                    >
                        Validate filter
                    </Button>
                )}
                {showResetButton && (
                    <Button
                        type={"button"}
                        variant={"secondary"}
                        onClick={resetForm}
                    >
                        Reset filter
                    </Button>
                )}
            </Row>
        </Form>
    );
}

function filterOutUndefined(obj: FormMembersFiltering): string[] {
    const result: string[] = [];

    for (const key in obj) {
        // @ts-ignore
        const value = obj[key];

        // Check if min/max are defined, or if the value is an array and not empty
        if (value && typeof value === "object") {
            // Check if min/max are defined and not undefined
            if (
                ("min" in value && value.min !== undefined) ||
                ("max" in value && value.max !== undefined)
            ) {
                result.push(key);
            }
        } else if (Array.isArray(value) && value.length > 0) {
            result.push(key);
        }
    }

    return result;
}
