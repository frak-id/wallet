import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { FormField, FormItem, FormMessage } from "@/module/forms/Form";
import {
    type GetMembersParam,
    getMerchantsMembersCount,
} from "@/module/members/api/getMerchantMembers";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";
import { MembersFiltering } from "@/module/members/component/MembersFiltering";

/**
 * Audience panel — push audiences are always filter-based.
 */
export function AudiencePanel() {
    const { t } = useTranslation();
    const { control } = useFormContext<FormCreatePushNotification>();

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("members.audience.title")}</CardTitle>
            </CardHeader>
            <FormField
                control={control}
                name={"target"}
                rules={{
                    required: t("members.audience.required"),
                }}
                render={() => (
                    <FormItem>
                        <SelectAudience />
                        <FormMessage />
                    </FormItem>
                )}
            />
        </Card>
    );
}

function SelectAudience() {
    const { t } = useTranslation();
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
            <p>{t("members.audience.reach", { count: targetAudience ?? 0 })}</p>
            {targetAudience === 0 && (
                <p className={"error"}>{t("members.audience.minMember")}</p>
            )}
        </>
    );
}
