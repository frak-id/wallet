import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { Form } from "@/module/forms/Form";
import type { GetMembersParam } from "@/module/members/api/getMerchantMembers";
import { InteractionsFiltering } from "@/module/members/component/MembersFiltering/InteractionsFiltering";
import { MembershipDateFiltering } from "@/module/members/component/MembersFiltering/MembershipDateFiltering";
import { membersStore } from "@/stores/membersStore";

/**
 * Filter for the members fetching process
 */
export type FormMembersFiltering = GetMembersParam["filter"] & {};

/**
 * Members filtering — scoped to the active merchant.
 *
 * The `merchantIds` filter is set by the route loader and is intentionally
 * not editable here: members are always scoped to the merchant in the URL
 * (the header switcher is the source of truth for cross-merchant moves).
 */
/**
 * Which filter fields to render. `"all"` (default) keeps both — used by the
 * push-creation audience panel. The members table's "Filters" popover renders
 * only `"interactions"`; its date range lives in a separate range picker.
 */
export type MembersFilteringSection = "all" | "interactions";

export function MembersFiltering({
    onFilterSet,
    initialValue,
    disabled,
    showResetButton,
    section = "all",
}: {
    onFilterSet: (filter: FormMembersFiltering) => void;
    initialValue?: FormMembersFiltering;
    disabled?: boolean;
    showResetButton?: boolean;
    section?: MembersFilteringSection;
}) {
    const { t } = useTranslation();
    const setFiltersDirtyCount = membersStore(
        (state) => state.setTableFiltersCount
    );

    const form = useForm<FormMembersFiltering>({
        values: initialValue,
        defaultValues: {},
    });

    function resetForm() {
        // Only clear the slice this section owns; preserve the other so the
        // interactions popover doesn't wipe a date range set elsewhere.
        const cleared: FormMembersFiltering = { ...initialValue };
        if (section === "all") {
            cleared.firstInteractionTimestamp = undefined;
        }
        cleared.interactions = undefined;
        form.reset(cleared);
        onFilterSet(cleared);
        setFiltersDirtyCount(0);
    }

    const onSubmit = useCallback(
        async (data: FormMembersFiltering) => {
            data.interactions = fixInteractions(data.interactions);

            // Always preserve the merchant scope set by the route loader.
            data.merchantIds = initialValue?.merchantIds;

            // Fix firstInteractionTimestamp if no filter provided
            data.firstInteractionTimestamp = fixFirstInteractionTimestamp(
                data.firstInteractionTimestamp
            );

            onFilterSet(data);
        },
        [onFilterSet, initialValue?.merchantIds]
    );

    const commonProps = {
        disabled,
        onSubmit,
    };

    return (
        <Form {...form}>
            <Stack space="m">
                {section === "all" && (
                    <MembershipDateFiltering {...commonProps} />
                )}
                <InteractionsFiltering {...commonProps} />

                {showResetButton && (
                    <Inline space="m" alignY="bottom" align="right">
                        <Button
                            type={"button"}
                            variant={"secondary"}
                            onClick={resetForm}
                        >
                            {t("members.filters.reset")}
                        </Button>
                    </Inline>
                )}
            </Stack>
        </Form>
    );
}

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
