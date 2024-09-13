import {
    sendPushForFilter,
    sendPushNotification,
} from "@/context/crm/actions/sendPush";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { ButtonWithConfirmationAlert } from "@/module/common/component/ButtonWithConfirmationAlert";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { currentPushCreationForm } from "@/module/members/atoms/pushCreationForm";
import { PushRecap } from "@/module/members/component/CreatePushConfirmation/PushRecap";
import { Button } from "@module/component/Button";
import { Spinner } from "@module/component/Spinner";
import { useMutation } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useSetAtom } from "jotai/index";
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
            <ConfirmationContent />
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
                throw new Error("No push campaign found");
            }

            if ("wallets" in currentPushCreation.target) {
                await sendPushNotification({
                    wallets: currentPushCreation.target.wallets,
                    payload: currentPushCreation.payload,
                });
            } else if ("filter" in currentPushCreation.target) {
                await sendPushForFilter({
                    filter: currentPushCreation.target.filter,
                    payload: currentPushCreation.payload,
                });
            }

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
                        {error && <span>{error.message}</span>}
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
                            variant={"information"}
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
