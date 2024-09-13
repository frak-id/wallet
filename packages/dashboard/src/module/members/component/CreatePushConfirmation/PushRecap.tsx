import type { FormCreatePushNotification } from "@/module/members/component/CreatePush";
import {
    type FormMembersFiltering,
    MembersFiltering,
} from "@/module/members/component/MembersFiltering";
import { Input } from "@module/component/forms/Input";
import type { Address } from "viem";

/**
 * Component with a recap of the push notification
 * @constructor
 */
export function PushRecap({
    pushForm,
}: { pushForm: FormCreatePushNotification }) {
    return (
        <>
            <h3>Title</h3>
            <Input
                type={"text"}
                disabled={true}
                value={pushForm.pushCampaignTitle}
            />
            <h3>Message</h3>
            <Input
                type={"text"}
                disabled={true}
                value={pushForm.payload.title}
            />
            <Input
                type={"text"}
                disabled={true}
                value={pushForm.payload.body}
            />
            <h3>Segment</h3>
            {pushForm.target && "wallets" in pushForm.target && (
                <WalletFilterRecap wallets={pushForm.target.wallets} />
            )}
            {pushForm.target && "filter" in pushForm.target && (
                <SegmentFilterRecap filter={pushForm.target.filter} />
            )}
        </>
    );
}

function WalletFilterRecap({ wallets }: { wallets: Address[] }) {
    return (
        <>
            <p>
                Will send the push to the <strong>{wallets.length}</strong>{" "}
                wallets you selected
            </p>
        </>
    );
}

function SegmentFilterRecap({ filter }: { filter: FormMembersFiltering }) {
    return (
        <MembersFiltering
            onFilterSet={() => {}}
            disabled={true}
            initialValue={filter}
        />
    );
}
