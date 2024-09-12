"use client";

import type { GetMembersParam } from "@/context/members/action/getProductMembers";
import { Form } from "@/module/forms/Form";
import { InteractionsFiltering } from "@/module/members/component/MembersFiltering/InteractionsFiltering";
import { MembershipDateFiltering } from "@/module/members/component/MembersFiltering/MembershipDateFiltering";
import { ProductFiltering } from "@/module/members/component/MembersFiltering/ProductFiltering";
import { RewardFiltering } from "@/module/members/component/MembersFiltering/RewardFiltering";
import { Button } from "@module/component/Button";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { parseEther, toHex } from "viem";

/**
 * Filter for the members fetching process
 */
export type FormMembersFiltering = GetMembersParam["filter"] & {};

/**
 * Members filtering
 * @constructor
 */
export function MembersFiltering({
    onFilterSet,
}: { onFilterSet: (filter: FormMembersFiltering) => void }) {
    const form = useForm<FormMembersFiltering>({
        defaultValues: {},
    });

    const onSubmit = useCallback(
        async (data: FormMembersFiltering) => {
            console.log("Form filter set", { data });

            // Fix rewards min and max if needed
            if (data.rewards) {
                const { min, max } = data.rewards;
                if (min) {
                    data.rewards.min = toHex(parseEther(min));
                }
                if (max) {
                    data.rewards.max = toHex(parseEther(max));
                }
            }
            // todo: Some verification here?
            onFilterSet(data);
        },
        [onFilterSet]
    );

    return (
        <Form {...form}>
            <ProductFiltering />
            <MembershipDateFiltering />
            <InteractionsFiltering />
            <RewardFiltering />

            <Button
                type={"button"}
                variant={"secondary"}
                onClick={form.handleSubmit(onSubmit)}
            >
                Validate filter
            </Button>
        </Form>
    );
}
