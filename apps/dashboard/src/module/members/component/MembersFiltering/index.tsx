"use client";

import type { GetMembersParam } from "@/context/members/action/getProductMembers";
import { Row } from "@/module/common/component/Row";
import { Form } from "@/module/forms/Form";
import { tableMembersFiltersCountAtom } from "@/module/members/atoms/tableMembers";
import { InteractionsFiltering } from "@/module/members/component/MembersFiltering/InteractionsFiltering";
import { MembershipDateFiltering } from "@/module/members/component/MembersFiltering/MembershipDateFiltering";
import { ProductFiltering } from "@/module/members/component/MembersFiltering/ProductFiltering";
import { RewardFiltering } from "@/module/members/component/MembersFiltering/RewardFiltering";
import { Button } from "@frak-labs/ui/component/Button";
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

        // Map min and max rewards if present
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
            // Fix rewards min and max if needed
            data.rewards = fixRewards(data.rewards);

            // Fix interactions if no filter provided
            data.interactions = fixInteractions(data.interactions);

            // Fix productIds if no filter provided
            data.productIds = fixProductIds(data.productIds);

            // Fix firstInteractionTimestamp if no filter provided
            data.firstInteractionTimestamp = fixFirstInteractionTimestamp(
                data.firstInteractionTimestamp
            );

            onFilterSet(data);
        },
        [onFilterSet]
    );

    const commonProps = {
        disabled,
        onSubmit,
    };

    return (
        <Form {...form}>
            <ProductFiltering {...commonProps} />
            <MembershipDateFiltering {...commonProps} />
            <InteractionsFiltering {...commonProps} />
            <RewardFiltering {...commonProps} />

            <Row>
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

/**
 * Fix rewards min and max values
 * @param rewards
 */
const fixRewards = (rewards: FormMembersFiltering["rewards"]) => {
    if (rewards) {
        const { min, max } = rewards;
        if (min) rewards.min = toHex(parseEther(min));
        if (max) rewards.max = toHex(parseEther(max));
        if (!(min || max)) return undefined;
        return rewards;
    }
    return rewards;
};

/**
 * Fix interactions min and max values
 * @param interactions
 */
const fixInteractions = (
    interactions: FormMembersFiltering["interactions"]
) => {
    if (!(interactions?.min || interactions?.max)) {
        return undefined;
    }
    return interactions;
};

/**
 * Fix productIds values
 * @param productIds
 */
const fixProductIds = (productIds: FormMembersFiltering["productIds"]) => {
    if (!productIds?.length) {
        return undefined;
    }
    return productIds;
};

/**
 * Fix firstInteractionTimestamp min and max values
 * @param firstInteractionTimestamp
 */
const fixFirstInteractionTimestamp = (
    firstInteractionTimestamp: FormMembersFiltering["firstInteractionTimestamp"]
) => {
    if (!(firstInteractionTimestamp?.min || firstInteractionTimestamp?.max)) {
        return undefined;
    }
    return firstInteractionTimestamp;
};
