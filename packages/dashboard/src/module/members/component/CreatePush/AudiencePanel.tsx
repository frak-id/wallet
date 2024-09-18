"use client";

import {
    type GetMembersParam,
    getProductsMembersCount,
} from "@/context/members/action/getProductMembers";
import { Panel } from "@/module/common/component/Panel";
import { FormField, FormItem, FormMessage } from "@/module/forms/Form";
import { selectedMembersAtom } from "@/module/members/atoms/selectedMembers";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush";
import { MembersFiltering } from "@/module/members/component/MembersFiltering";
import { Button } from "@module/component/Button";
import { useMutation } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import type { Address } from "viem";

/**
 * Audience panel
 * @constructor
 */
export function AudiencePanel() {
    const { control } = useFormContext<FormCreatePushNotification>();
    const selectedMembers = useAtomValue(selectedMembersAtom);

    return (
        <Panel title={"Audience"}>
            <FormField
                control={control}
                name={"target"}
                rules={{
                    required: "Push audience is required",
                }}
                render={() => (
                    <FormItem>
                        {selectedMembers?.length && (
                            <PreSelectedMembers members={selectedMembers} />
                        )}
                        {!selectedMembers?.length && <SelectAudience />}
                        <FormMessage />
                    </FormItem>
                )}
            />
        </Panel>
    );
}

/**
 * If the members are pre-selected, directly set the right value
 * @param members
 * @constructor
 */
function PreSelectedMembers({ members }: { members: Address[] }) {
    const setSelectedMembers = useSetAtom(selectedMembersAtom);
    const { setValue } = useFormContext<FormCreatePushNotification>();

    useEffect(() => {
        setValue("target.wallets", members);
        setValue("targetCount", members.length);
    }, [members, setValue]);

    return (
        <>
            <p>
                You have selected <strong>{members.length}</strong> members to
                receive the notification
            </p>

            <Button
                onClick={() => {
                    setSelectedMembers(undefined);
                    setValue("target", undefined);
                    setValue("targetCount", 0);
                }}
                variant={"danger"}
            >
                Clear selected members
            </Button>
        </>
    );
}

function SelectAudience() {
    const { setValue, getValues } =
        useFormContext<FormCreatePushNotification>();
    const initialValue = getValues("target.filter");

    const { mutate: computeAudienceSize, data: targetAudience } = useMutation({
        mutationKey: ["create-push", "compute=audience-size"],
        mutationFn: async (filter: GetMembersParam["filter"]) => {
            // Get the number of user who will be concerned by this filter
            return await getProductsMembersCount({ filter });
        },
    });

    useEffect(() => {
        if (!initialValue) return;
        computeAudienceSize(initialValue);
    }, [initialValue, computeAudienceSize]);

    return (
        <>
            <MembersFiltering
                onFilterSet={(filter) => {
                    computeAudienceSize(filter);
                    setValue("target.filter", filter);
                    setValue("targetCount", targetAudience ?? 0);
                }}
                initialValue={initialValue}
            />
            <p>
                You will reach <strong>{targetAudience ?? 0}</strong> members
            </p>
            {targetAudience === 0 && (
                <p className={"error"}>You need a least 1 member to continue</p>
            )}
        </>
    );
}
