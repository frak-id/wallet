import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { authenticatedBackendApi } from "@/api/backendClient";
import { ActionsMessageError } from "@/module/campaigns/component/Actions";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { Button } from "@/module/common/component/Button";
import { ButtonWithConfirmationAlert } from "@/module/common/component/ButtonWithConfirmationAlert";
import { Head } from "@/module/common/component/Head";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { FormLayout } from "@/module/forms/Form";
import { PushRecap } from "@/module/members/component/CreatePushConfirmation/PushRecap";
import { pushCreationStore } from "@/stores/pushCreationStore";

/**
 * Pull a human-readable message out of an Eden Treaty error.
 *
 * Eden returns `{ value, status }` where `value` is the body returned by
 * the Elysia handler — usually `{ message: string }`, sometimes a plain
 * string (legacy handlers). We walk both shapes before falling back to
 * a generic message so backend errors surface to the user.
 */
function extractSendError(error: unknown): string {
    if (typeof error === "string") return error;
    if (typeof error !== "object" || error === null) {
        return "Failed to send push notification";
    }
    const value = (error as { value?: unknown }).value;
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "object" && value !== null) {
        const message = (value as { message?: unknown }).message;
        if (typeof message === "string" && message.length > 0) return message;
    }
    return "Failed to send push notification";
}

/**
 * Confirm the creation of a push notification
 * @constructor
 */
export function CreatePushNotificationConfirmation() {
    const setForm = pushCreationStore((state) => state.setForm);
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();

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
                            navigate({
                                to: "/m/$merchantId/members",
                                params: { merchantId },
                            });
                        }}
                    />
                }
            />
            <FormLayout>
                <ConfirmationContent merchantId={merchantId} />
            </FormLayout>
        </>
    );
}

function ConfirmationContent({ merchantId }: { merchantId: string }) {
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
            // Eden Treaty returns `{ data, error }` rather than throwing —
            // surface the error so the mutation's `onError` fires and we
            // don't clear the draft on failure (the user may want to
            // retry without losing their work).
            const { error: sendError } =
                await authenticatedBackendApi.notifications.send.post({
                    merchantId,
                    targets: target,
                    payload: {
                        ...payload,
                        body: payload.body ?? "",
                        silent: payload.silent ?? false,
                    },
                });
            if (sendError) {
                throw new Error(extractSendError(sendError));
            }
        },
        onSuccess: () => {
            // Cleanup belongs on the success path so a transient backend
            // failure leaves the draft intact for retry.
            setForm(undefined);
            navigate({
                to: "/m/$merchantId/members",
                params: { merchantId },
            });
        },
    });

    if (!currentPushCreation) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Check your push</CardTitle>
                </CardHeader>
                <Link to="/m/$merchantId/members" params={{ merchantId }}>
                    Push not found, go back
                </Link>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Check your push</CardTitle>
                </CardHeader>
                <PushRecap pushForm={currentPushCreation} />
            </Card>
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
                                // Intentionally preserves the draft so the
                                // user can resume later (matches the
                                // confirmation copy above).
                                navigate({
                                    to: "/m/$merchantId/members",
                                    params: { merchantId },
                                });
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
                            variant={"secondary"}
                            disabled={isPending}
                            onClick={() => {
                                window.history.back();
                            }}
                        >
                            Previous
                        </Button>
                        <Button
                            type={"button"}
                            variant={"primary"}
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
