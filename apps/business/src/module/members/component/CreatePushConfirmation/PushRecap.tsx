import { useMemo } from "react";
import { useForm } from "react-hook-form";
import type { Address } from "viem";
import { Form, FormDescription, FormItem } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import { PushPreviewNotification } from "@/module/members/component/CreatePush/PushPreview";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";
import {
    type FormMembersFiltering,
    MembersFiltering,
} from "@/module/members/component/MembersFiltering";
import * as styles from "./push-recap.css";

/**
 * Component with a recap of the push notification
 * @constructor
 */
export function PushRecap({
    pushForm,
}: {
    pushForm: FormCreatePushNotification;
}) {
    const form = useForm<FormCreatePushNotification>({
        values: useMemo(() => pushForm, [pushForm]),
    });

    return (
        <Form {...form}>
            <FormItem>
                <FormDescription label={"Push Title"} />
                <Input
                    length={"big"}
                    disabled={true}
                    {...form.register("pushCampaignTitle")}
                />
            </FormItem>
            <FormItem>
                <FormDescription label={"Message"} />
                <div className={styles.pushRecapNotificationWrapper}>
                    <PushPreviewNotification
                        title={pushForm.payload.title}
                        message={pushForm.payload.body}
                        icon={pushForm.payload.icon}
                        className={styles.pushRecapNotification}
                        classNameDate={styles.pushRecapNotificationDate}
                    />
                </div>
            </FormItem>
            {pushForm.target && "wallets" in pushForm.target && (
                <WalletFilterRecap wallets={pushForm.target.wallets} />
            )}
            {pushForm.target && "filter" in pushForm.target && (
                <SegmentFilterRecap filter={pushForm.target.filter} />
            )}
        </Form>
    );
}

function WalletFilterRecap({ wallets }: { wallets: Address[] }) {
    return (
        <p>
            Will send the push to the <strong>{wallets.length}</strong> wallets
            you selected
        </p>
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
