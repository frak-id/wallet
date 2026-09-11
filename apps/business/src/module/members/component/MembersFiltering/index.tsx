import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { Form } from "@/module/forms/Form";
import type { GetMembersParam } from "@/module/members/api/getMerchantMembers";
import { InteractionsFiltering } from "@/module/members/component/MembersFiltering/InteractionsFiltering";
import { membersStore } from "@/stores/membersStore";

export type FormMembersFiltering = GetMembersParam["filter"] & {};

/**
 * Members filtering — scoped to the active merchant.
 *
 * The `merchantIds` filter is set by the route loader and is intentionally
 * not editable here: members are always scoped to the merchant in the URL
 * (the header switcher is the source of truth for cross-merchant moves).
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
    const { t } = useTranslation();
    const setFiltersDirtyCount = membersStore(
        (state) => state.setTableFiltersCount
    );

    const form = useForm<FormMembersFiltering>({
        values: initialValue,
        defaultValues: {},
    });

    function resetForm() {
        // Preserve the date range, which the separate range picker owns.
        const cleared: FormMembersFiltering = { ...initialValue };
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

const fixInteractions = (
    interactions: FormMembersFiltering["interactions"]
) => {
    if (!(interactions?.min || interactions?.max)) {
        return undefined;
    }
    return interactions;
};
