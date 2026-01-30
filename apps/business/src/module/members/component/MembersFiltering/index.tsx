import { Button } from "@frak-labs/ui/component/Button";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import type { GetMembersParam } from "@/context/members/action/getMerchantMembers";
import { Row } from "@/module/common/component/Row";
import { Form } from "@/module/forms/Form";
import { InteractionsFiltering } from "@/module/members/component/MembersFiltering/InteractionsFiltering";
import { MembershipDateFiltering } from "@/module/members/component/MembersFiltering/MembershipDateFiltering";
import { MerchantFiltering } from "@/module/members/component/MembersFiltering/MerchantFiltering";
import { membersStore } from "@/stores/membersStore";

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
    const setFiltersDirtyCount = membersStore(
        (state) => state.setTableFiltersCount
    );

    const form = useForm<FormMembersFiltering>({
        values: initialValue,
        defaultValues: {},
    });

    function resetForm() {
        const defaultValues = {
            merchantIds: undefined,
            interactions: undefined,
            firstInteractionTimestamp: undefined,
        };
        form.reset(defaultValues);
        onFilterSet(defaultValues);
        setFiltersDirtyCount(0);
    }

    const onSubmit = useCallback(
        async (data: FormMembersFiltering) => {
            data.interactions = fixInteractions(data.interactions);

            // Fix merchantIds if no filter provided
            data.merchantIds = fixMerchantIds(data.merchantIds);

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
            <MerchantFiltering {...commonProps} />
            <MembershipDateFiltering {...commonProps} />
            <InteractionsFiltering {...commonProps} />
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

const fixMerchantIds = (merchantIds: FormMembersFiltering["merchantIds"]) => {
    if (!merchantIds?.length) {
        return undefined;
    }
    return merchantIds;
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
