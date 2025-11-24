import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { ActionsMessageError } from "@/module/campaigns/component/Actions";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { ButtonWithConfirmationAlert } from "@/module/common/component/ButtonWithConfirmationAlert";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { FormLayout } from "@/module/forms/Form";
import { PushRecap } from "@/module/members/component/CreatePushConfirmation/PushRecap";
import { pushCreationStore } from "@/stores/pushCreationStore";

/**
 * Confirm the creation of a push notification
 * @constructor
 */
export function CreatePushNotificationConfirmation() {
    const setForm = pushCreationStore((state) => state.setForm);

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
                            setForm(undefined);
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
    const currentPushCreation = pushCreationStore(
        (state) => state.currentPushCreationForm
    );
    const setForm = pushCreationStore((state) => state.setForm);
    const navigate = useNavigate();

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

            await authenticatedBackendApi.notifications.send.post({
                targets: target,
                payload: {
                    ...payload,
                    body: payload.body ?? "",
                    silent: payload.silent ?? false,
                },
            });

            console.log("Push submitted, resetting everything");
            setForm(undefined);
            navigate({ to: "/members" });
        },
    });

    if (!currentPushCreation) {
        return (
            <Panel title={"Check your push"}>
                <Link to={"/members"}>Push not found, go back</Link>
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
                                navigate({ to: "/members" });
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
                                window.history.back();
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
