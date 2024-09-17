import { FormDescription, FormItem } from "@/module/forms/Form";
import { Form } from "@/module/forms/Form";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush";
import { PushPreviewNotification } from "@/module/members/component/CreatePush/PushPreview";
import {
    type FormMembersFiltering,
    MembersFiltering,
} from "@/module/members/component/MembersFiltering";
import { Input } from "@module/component/forms/Input";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import type { Address } from "viem";
import styles from "./PushRecap.module.css";

/**
 * Component with a recap of the push notification
 * @constructor
 */
export function PushRecap({
    pushForm,
}: { pushForm: FormCreatePushNotification }) {
    const form = useForm<FormCreatePushNotification>({
        values: useMemo(() => pushForm, [pushForm]),
    });

    return (
        <Form {...form}>
            <FormItem>
                <FormDescription title={"Push Title"} />
                <Input
                    length={"big"}
                    disabled={true}
                    {...form.register("pushCampaignTitle")}
                />
            </FormItem>
            <FormItem>
                <FormDescription title={"Message"} />
                <div className={styles.pushRecap__notificationWrapper}>
                    <PushPreviewNotification
                        title={pushForm.payload.title}
                        message={pushForm.payload.body}
                        className={styles.pushRecap__notification}
                        classNameDate={styles.pushRecap__notificationDate}
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
