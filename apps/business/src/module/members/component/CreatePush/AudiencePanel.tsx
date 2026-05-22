import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import type { Address } from "viem";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Button } from "@/module/common/component/Button";
import { FormField, FormItem, FormMessage } from "@/module/forms/Form";
import {
    type GetMembersParam,
    getMerchantsMembersCount,
} from "@/module/members/api/getMerchantMembers";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";
import { MembersFiltering } from "@/module/members/component/MembersFiltering";
import { membersStore } from "@/stores/membersStore";

/**
 * Audience panel
 * @constructor
 */
export function AudiencePanel() {
    const { control } = useFormContext<FormCreatePushNotification>();
    const selectedMembers = membersStore((state) => state.selectedMembers);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Audience</CardTitle>
            </CardHeader>
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
        </Card>
    );
}

/**
 * If the members are pre-selected, directly set the right value
 * @param members
 * @constructor
 */
function PreSelectedMembers({ members }: { members: Address[] }) {
    const clearSelection = membersStore((state) => state.clearSelection);
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
                    clearSelection();
                    setValue("target", undefined);
                    setValue("targetCount", 0);
                }}
                variant={"destructive"}
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
    const isDemoMode = useIsDemoMode();

    const { mutate: computeAudienceSize, data: targetAudience } = useMutation({
        mutationKey: ["create-push", "compute-audience-size"],
        mutationFn: async (filter: GetMembersParam["filter"]) => {
            return getMerchantsMembersCount({ filter }, isDemoMode);
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
