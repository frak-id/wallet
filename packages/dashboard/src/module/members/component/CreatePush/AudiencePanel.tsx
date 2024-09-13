"use client";

import {
    type GetMembersParam,
    getProductsMembersCount,
} from "@/context/members/action/getProductMembers";
import { Panel } from "@/module/common/component/Panel";
import { selectedMembersAtom } from "@/module/members/atoms/selectedMembers";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/index";
import { MembersFiltering } from "@/module/members/component/MembersFiltering";
import { Button } from "@module/component/Button";
import { Spinner } from "@module/component/Spinner";
import { useMutation } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useSetAtom } from "jotai/index";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import type { Address } from "viem";

/**
 * Audience panel
 * @constructor
 */
export function AudiencePanel() {
    const selectedMembers = useAtomValue(selectedMembersAtom);

    return (
        <Panel title={"Audience"}>
            {selectedMembers?.length && (
                <PreSelectedMembers members={selectedMembers} />
            )}
            {!selectedMembers?.length && <SelectAudience />}
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
                }}
                variant={"danger"}
            >
                Clear selected members
            </Button>
        </>
    );
}

function SelectAudience() {
    const { setValue } = useFormContext<FormCreatePushNotification>();

    const {
        mutate: computeAudienceSize,
        data: targetAudience,
        isPending,
    } = useMutation({
        mutationKey: ["create-push", "compute=audience-size"],
        mutationFn: async (filter: GetMembersParam["filter"]) => {
            // Get the number of user who will be concerned by this filter
            return await getProductsMembersCount({ filter });
        },
    });

    return (
        <>
            <MembersFiltering
                onFilterSet={(filter) => {
                    computeAudienceSize(filter);
                    setValue("target.filter", filter);
                }}
            />
            <p>
                You will reach{" "}
                <strong>{isPending ? <Spinner /> : targetAudience ?? 0}</strong>{" "}
                members
            </p>
        </>
    );
}
