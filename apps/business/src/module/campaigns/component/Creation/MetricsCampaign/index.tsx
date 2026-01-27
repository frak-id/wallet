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
import { campaignStore } from "@/stores/campaignStore";
import { FormTrigger } from "../Generic/FormTrigger";

// FIAT CONVERSION PIPELINE:
// 1. User enters fiat amount (e.g., €5.00)
// 2. On save, getBankInfo() fetches token exchange rate
// 3. Commission applied: fiatAmount * 0.8 (20% Frak fee)
// 4. Converted to token: (fiatAmount * 0.8) * exchangeRate * 10^decimals
// 5. Final token amount sent to backend as reward.amount

export function MetricsCampaign() {
    const campaign = campaignStore((state) => state.campaign);
    const saveCampaign = useSaveCampaign();

    const form = useForm({
        values: useMemo(() => campaign, [campaign]),
    });

    function handleSave(values: typeof campaign) {
        campaignStore.getState().setCampaign({ ...campaign, ...values });

        const payload = {
            merchantId: values.merchantId,
            name: values.name,
            priority: values.priority,
            rule: {
                trigger: values.trigger,
                conditions: { logic: "all" as const, conditions: [] },
                rewards: [
                    {
                        recipient: values.rewardRecipient,
                        type: "token" as const,
                        amountType: "fixed" as const,
                        amount: values.rewardAmount,
                        chaining: values.rewardChaining,
                    },
                ],
            },
        };

        saveCampaign.mutate(payload);
    }

    return (
        <FormLayout>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSave)}>
                    <Head
                        title={{ content: "Campaign Rules", size: "small" }}
                        rightSection={
                            <ButtonCancel
                                onClick={() => {
                                    form.reset(campaign);
                                }}
                            />
                        }
                    />

                    <Panel title="Rule Configuration">
                        <FormTrigger />

                        <Row>
                            <FormField
                                control={form.control}
                                name="rewardAmount"
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
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </Row>

                        <FormField
                            control={form.control}
                            name="rewardRecipient"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reward Recipient</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
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
                    </Panel>

                    <Panel title="Reward Chaining (Optional)">
                        <Row>
                            <FormField
                                control={form.control}
                                name="rewardChaining.userPercent"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>User Percent</FormLabel>
                                        <FormControl>
                                            <input
                                                type="number"
                                                step="0.01"
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
                                name="rewardChaining.deperditionPerLevel"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Deperdition / Level
                                        </FormLabel>
                                        <FormControl>
                                            <input
                                                type="number"
                                                step="0.01"
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
                                name="rewardChaining.maxDepth"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Max Depth</FormLabel>
                                        <FormControl>
                                            <input
                                                type="number"
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

                    <Actions isLoading={form.formState.isSubmitting} />
                </form>
            </Form>
        </FormLayout>
    );
}
