"use client";
import { ActionsMessageError } from "@/module/campaigns/component/Actions";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { ButtonWithConfirmationAlert } from "@/module/common/component/ButtonWithConfirmationAlert";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { FormLayout } from "@/module/forms/Form";
import { currentPushCreationForm } from "@/module/members/atoms/pushCreationForm";
import { PushRecap } from "@/module/members/component/CreatePushConfirmation/PushRecap";
import { businessApi } from "@frak-labs/client/server";
import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useMutation } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Confirm the creation of a push notification
 * @constructor
 */
export function CreatePushNotificationConfirmation() {
    const setPushCreationValue = useSetAtom(currentPushCreationForm);

    return (
        <>
            <Head
                title={{
                    content: "Push Notification Validation",
                    size: "small",
                }}
                rightSection={
                    <ButtonWithConfirmationAlert
                        description={
                            "Are you sure you want to discard everything related to your new push notification?"
                        }
                        onClick={() => {
                            setPushCreationValue(undefined);
                            window.location.href = "/members";
                        }}
                    />
                }
            />
            <FormLayout>
                <ConfirmationContent />
            </FormLayout>
        </>
    );
}

function ConfirmationContent() {
    const [currentPushCreation, setCurrentPushCreation] = useAtom(
        currentPushCreationForm
    );
    const router = useRouter();

    const {
        mutate: publishPushCampaign,
        isPending,
        error,
    } = useMutation({
        mutationKey: ["push", "publish"],
        mutationFn: async () => {
            if (!currentPushCreation?.target) {
                throw new Error("No target specified");
            }

            const { payload, target } = currentPushCreation;

            await businessApi.notifications.send.post({
                targets: target,
                payload: {
                    ...payload,
                    body: payload.body ?? "",
                    silent: payload.silent ?? false,
                },
            });

            console.log("Push submitted, resetting everything");
            setCurrentPushCreation(undefined);
            router.push("/members");
        },
    });

    if (!currentPushCreation) {
        return (
            <Panel title={"Check your push"}>
                <Link href={"/members"}>Push not found, go back</Link>
            </Panel>
        );
    }

    return (
        <>
            <Panel title={"Check your push"}>
                <PushRecap pushForm={currentPushCreation} />
            </Panel>
            <ActionsWrapper
                left={
                    <>
                        <ButtonWithConfirmationAlert
                            description={
                                <>
                                    <p>
                                        Do you want to stop this push
                                        notification campaign creation?
                                    </p>
                                    <p>
                                        You will be able to continue it's
                                        creation later
                                    </p>
                                </>
                            }
                            title={"Close"}
                            buttonText={"Close"}
                            onClick={() => {
                                router.push("/members");
                            }}
                            disabled={isPending}
                        />
                        {error && <ActionsMessageError error={error} />}
                    </>
                }
                right={
                    <>
                        <Button
                            type={"button"}
                            variant={"informationOutline"}
                            disabled={isPending}
                            onClick={() => {
                                router.back();
                            }}
                        >
                            Previous
                        </Button>
                        <Button
                            type={"button"}
                            variant={"submit"}
                            disabled={isPending}
                            onClick={() => {
                                publishPushCampaign();
                            }}
                        >
                            {isPending && <Spinner />}
                            Publish
                        </Button>
                    </>
                }
            />
        </>
    );
}
