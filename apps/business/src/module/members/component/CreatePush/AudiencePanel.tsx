import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { EditCard } from "@/module/common/component/EditCard";
import { useDebouncedValue } from "@/module/common/hook/useDebouncedValue";
import { FormField, FormItem, FormMessage } from "@/module/forms/Form";
import { getMerchantsMembersCount } from "@/module/members/api/getMerchantMembers";
import { AudienceFilter } from "@/module/members/component/CreatePush/AudienceFilter";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";

const COUNT_DEBOUNCE_MS = 400;

/**
 * Audience panel — push audiences are always filter-based.
 */
export function AudiencePanel() {
    const { t } = useTranslation();
    const { control } = useFormContext<FormCreatePushNotification>();

    return (
        <EditCard
            title={t("push.create.audience.title")}
            description={t("push.create.audience.description")}
        >
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
        </EditCard>
    );
}

function SelectAudience() {
    const { t } = useTranslation();
    const { control, setValue, getValues } =
        useFormContext<FormCreatePushNotification>();
    const isDemoMode = useIsDemoMode();

    // Watch the committed filter and debounce it so rapid edits collapse into
    // a single count request. The query key dedupes identical filters, and
    // keepPreviousData holds the last count during a refetch (no flicker).
    const filter = useWatch({ control, name: "target.filter" });
    const debouncedFilter = useDebouncedValue(filter, COUNT_DEBOUNCE_MS);

    const { data: count } = useQuery({
        queryKey: [
            "create-push",
            "audience-count",
            debouncedFilter,
            isDemoMode,
        ],
        queryFn: () =>
            getMerchantsMembersCount({ filter: debouncedFilter }, isDemoMode),
        enabled: debouncedFilter !== undefined,
        placeholderData: keepPreviousData,
    });

    useEffect(() => {
        if (count !== undefined) setValue("targetCount", count);
    }, [count, setValue]);

    return (
        <Stack space={"m"}>
            <AudienceFilter
                initialValue={getValues("target.filter")}
                onFilterSet={(updated) => setValue("target.filter", updated)}
            />
            <Text variant={"body"}>
                <Trans
                    i18nKey={"push.create.audience.matched"}
                    values={{ total: count ?? 0 }}
                    components={[
                        <Text key={"count"} as={"span"} weight={"semiBold"} />,
                    ]}
                />
            </Text>
            {count === 0 && (
                <FieldError>{t("members.audience.minMember")}</FieldError>
            )}
        </Stack>
    );
}
