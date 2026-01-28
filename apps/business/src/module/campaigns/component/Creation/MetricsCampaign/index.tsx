import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Head } from "@/module/common/component/Head";
import { InputAmountCampaign } from "@/module/common/component/InputAmount";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormLayout,
    FormMessage,
} from "@/module/forms/Form";
import { RadioGroup, RadioGroupItem } from "@/module/forms/RadioGroup";
import { type CampaignDraft, campaignStore } from "@/stores/campaignStore";
import { FormTrigger } from "../Generic/FormTrigger";

export function MetricsCampaign() {
    const navigate = useNavigate();
    const draft = campaignStore((s) => s.draft);
    const updateDraft = campaignStore((s) => s.updateDraft);
    const saveCampaign = useSaveCampaign();

    const form = useForm<CampaignDraft>({
        values: useMemo(() => draft, [draft]),
    });

    async function onSubmit(values: CampaignDraft) {
        updateDraft(() => values);
        const saved = await saveCampaign.mutateAsync(values);
        navigate({
            to: "/campaigns/draft/$campaignId/validation",
            params: { campaignId: saved.id },
        });
    }

    return (
        <FormLayout>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Head
                        title={{ content: "Campaign Rules", size: "small" }}
                        rightSection={
                            <ButtonCancel onClick={() => form.reset(draft)} />
                        }
                    />

                    <Panel title="Trigger & Reward">
                        <FormTrigger />

                        <Row>
                            <FormField
                                control={form.control}
                                name="rule.rewards.0.amount"
                                rules={{ required: "Required", min: 0 }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Reward Amount</FormLabel>
                                        <FormControl>
                                            <InputAmountCampaign
                                                placeholder="5.00"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="rule.rewards.0.recipient"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Recipient</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                style={{
                                                    display: "flex",
                                                    gap: "16px",
                                                }}
                                            >
                                                <FormItem variant="radio">
                                                    <FormControl>
                                                        <RadioGroupItem value="referrer" />
                                                    </FormControl>
                                                    <FormLabel variant="radio">
                                                        Referrer
                                                    </FormLabel>
                                                </FormItem>
                                                <FormItem variant="radio">
                                                    <FormControl>
                                                        <RadioGroupItem value="referee" />
                                                    </FormControl>
                                                    <FormLabel variant="radio">
                                                        Referee
                                                    </FormLabel>
                                                </FormItem>
                                                <FormItem variant="radio">
                                                    <FormControl>
                                                        <RadioGroupItem value="user" />
                                                    </FormControl>
                                                    <FormLabel variant="radio">
                                                        User
                                                    </FormLabel>
                                                </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </Row>

                        <FormField
                            control={form.control}
                            name="priority"
                            rules={{ required: "Required", min: 0 }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Priority</FormLabel>
                                    <FormControl>
                                        <input
                                            type="number"
                                            style={{
                                                height: "40px",
                                                width: "120px",
                                                borderRadius:
                                                    "var(--frak-radius-2)",
                                                border: "1px solid var(--frak-color-gray-4)",
                                                padding: "0 12px",
                                                fontSize: "14px",
                                            }}
                                            {...field}
                                            onChange={(e) =>
                                                field.onChange(
                                                    parseInt(
                                                        e.target.value,
                                                        10
                                                    ) || 0
                                                )
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </Panel>

                    <Panel title="Reward Chaining (Optional)">
                        <Row>
                            <FormField
                                control={form.control}
                                name="rule.rewards.0.chaining.userPercent"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>User %</FormLabel>
                                        <FormControl>
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="0.1"
                                                style={{
                                                    height: "40px",
                                                    width: "100%",
                                                    borderRadius:
                                                        "var(--frak-radius-2)",
                                                    border: "1px solid var(--frak-color-gray-4)",
                                                    padding: "0 12px",
                                                    fontSize: "14px",
                                                }}
                                                {...field}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        parseFloat(
                                                            e.target.value
                                                        ) || 0
                                                    )
                                                }
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="rule.rewards.0.chaining.deperditionPerLevel"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Deperdition/Level</FormLabel>
                                        <FormControl>
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="0.5"
                                                style={{
                                                    height: "40px",
                                                    width: "100%",
                                                    borderRadius:
                                                        "var(--frak-radius-2)",
                                                    border: "1px solid var(--frak-color-gray-4)",
                                                    padding: "0 12px",
                                                    fontSize: "14px",
                                                }}
                                                {...field}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        parseFloat(
                                                            e.target.value
                                                        ) || 0
                                                    )
                                                }
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="rule.rewards.0.chaining.maxDepth"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Max Depth</FormLabel>
                                        <FormControl>
                                            <input
                                                type="number"
                                                placeholder="3"
                                                style={{
                                                    height: "40px",
                                                    width: "100%",
                                                    borderRadius:
                                                        "var(--frak-radius-2)",
                                                    border: "1px solid var(--frak-color-gray-4)",
                                                    padding: "0 12px",
                                                    fontSize: "14px",
                                                }}
                                                {...field}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        parseInt(
                                                            e.target.value,
                                                            10
                                                        ) || 0
                                                    )
                                                }
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </Row>
                    </Panel>

                    <Actions isLoading={saveCampaign.isPending} />
                </form>
            </Form>
        </FormLayout>
    );
}
