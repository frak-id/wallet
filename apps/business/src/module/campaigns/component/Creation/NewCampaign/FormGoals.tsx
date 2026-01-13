import { useQuery } from "@tanstack/react-query";
import {
    AlertTriangle,
    MousePointer,
    RotateCw,
    ShoppingBag,
    User,
    Volume2,
} from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Hex } from "viem";
import {
    getGoalLabel,
    getProductTypeLabel,
    getProductTypesForGoal,
    isGoalCompatible,
} from "@/module/campaigns/utils/goalCompatibility";
import { Badge } from "@/module/common/component/Badge";
import { Column } from "@/module/common/component/Column";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { RadioGroup, RadioGroupItem } from "@/module/forms/RadioGroup";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";
import { useAuthStore } from "@/stores/authStore";
import type { Campaign } from "@/types/Campaign";
import styles from "./FormGoals.module.css";

type ItemGoals = {
    id: string;
    label: string;
    icon: ReactElement<unknown>;
    information?: {
        title: string;
        description: string;
        badges: string[];
    };
    disabled?: boolean;
};

const itemsGoals: ItemGoals[] = [
    {
        id: "traffic",
        label: "Traffic",
        icon: <MousePointer />,
        information: {
            title: "Traffic",
            description:
                "Redirect to a destination, such as your website, application...",
            badges: ["Link clicks", "Landing page views"],
        },
    },
    {
        id: "registration",
        label: "Registration",
        icon: <User />,
        information: {
            title: "Registration",
            description:
                "Create more registrations on your website for more qualified data and no longer depend on cookie consent.",
            badges: ["Registration", "CRM", "Qualified data"],
        },
    },
    {
        id: "sales",
        label: "Sales",
        icon: <ShoppingBag />,
        information: {
            title: "Sales",
            description:
                "Find people likely to subscribe or buy product on a pay-per-view basis",
            badges: ["Subscription", "Revenue", "Conversion"],
        },
    },
    {
        id: "awareness",
        label: "Awareness",
        icon: <Volume2 />,
        information: {
            title: "Awareness",
            description:
                "Show your ads to the people most likely to remember them.",
            badges: ["Coverage", "Brand awareness", "Video views"],
        },
        disabled: true,
    },
    {
        id: "retention",
        label: "Retention",
        icon: <RotateCw />,
        information: {
            title: "Retention",
            description:
                "Make your users want to come back to your website or app. Stand out from the crowd.",
            badges: ["Retention", "Loyalty", "Membership"],
        },
        disabled: true,
    },
] as const;

export function FormGoals(form: UseFormReturn<Campaign>) {
    const [goal, setGoal] = useState<ItemGoals | undefined>();
    const watchType = form.watch("type");

    // Get productId from form state (reacts to changes immediately)
    const productId = form.watch("productId");
    const isDemoMode = useAuthStore((state) => state.token === "demo-token");

    // Fetch product metadata to get product types
    const { data: productMetadata } = useQuery({
        ...productMetadataQueryOptions(productId as Hex, isDemoMode),
        enabled: !!productId,
    });

    // Check goal compatibility and generate warning message
    const warningMessage = useMemo(() => {
        // No warning if no product selected or no goal selected
        if (!productId || !watchType) return null;

        // No warning if product metadata not loaded yet
        if (!productMetadata?.productTypes) return null;

        const selectedGoal = watchType;
        const productTypes = productMetadata.productTypes;

        // Check if the selected goal is compatible with the product types
        if (isGoalCompatible(selectedGoal, productTypes)) return null;

        // Generate warning message
        const requiredTypes = getProductTypesForGoal(selectedGoal);
        const requiredTypesLabels = requiredTypes
            .map(getProductTypeLabel)
            .join(", ");
        const currentTypesLabels = productTypes
            .map(getProductTypeLabel)
            .join(", ");

        return `The "${getGoalLabel(selectedGoal)}" goal requires a product with ${requiredTypesLabels} type${requiredTypes.length > 1 ? "s" : ""}. Your product uses ${currentTypesLabels}.`;
    }, [productId, watchType, productMetadata]);

    /**
     * Set goal when we have a type
     */
    useEffect(() => {
        if (watchType === "") return;
        setGoal(
            watchType
                ? itemsGoals.find((item) => item.id === watchType)
                : undefined
        );
    }, [watchType]);

    return (
        <Panel title="Goals">
            <Column>
                <FormDescription>
                    The choice of your goal defines the event that generates the
                    distribution of rewards. Pay only when this goal is reached.
                </FormDescription>
            </Column>
            <Column fullWidth={true}>
                <FormField
                    control={form.control}
                    name="type"
                    rules={{ required: "Select a goal" }}
                    render={({ field }) => (
                        <FormItem>
                            <FormDescription label={"Campaign goal"} />
                            <Row align={"start"}>
                                <div>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={(value) => {
                                                field.onChange(value);
                                                setGoal(
                                                    itemsGoals.find(
                                                        (item) =>
                                                            item.id === value
                                                    )
                                                );
                                            }}
                                            defaultValue={field.value}
                                            {...field}
                                        >
                                            {itemsGoals.map((item) => (
                                                <FormItem
                                                    variant={"radio"}
                                                    key={item.id}
                                                >
                                                    <FormControl>
                                                        <RadioGroupItem
                                                            value={item.id}
                                                            disabled={
                                                                item.disabled
                                                            }
                                                        />
                                                    </FormControl>
                                                    <FormLabel
                                                        variant={"radio"}
                                                        className={
                                                            item.disabled
                                                                ? styles.formGoals__label_disabled
                                                                : styles.formGoals__label
                                                        }
                                                    >
                                                        {item.icon}
                                                        {item.label}
                                                    </FormLabel>
                                                </FormItem>
                                            ))}
                                        </RadioGroup>
                                    </FormControl>
                                </div>
                                <div
                                    className={
                                        styles.formGoals__informationWrapper
                                    }
                                >
                                    {goal && <GoalInformation goal={goal} />}
                                </div>
                            </Row>
                            <FormMessage />
                            {warningMessage && (
                                <div className={styles.formGoals__warning}>
                                    <AlertTriangle size={18} />
                                    <span>{warningMessage}</span>
                                </div>
                            )}
                        </FormItem>
                    )}
                />
            </Column>
        </Panel>
    );
}

function GoalInformation({ goal }: { goal: ItemGoals }) {
    if (!goal.information) return null;

    const {
        information: { title, description, badges },
    } = goal;

    return (
        <>
            <div
                className={`${styles.formGoals__information} ${styles[`formGoals__information--${goal.id}`]}`}
            >
                <h4 className={styles.formGoals__title}>{title}</h4>
                <p>{description}</p>
            </div>
            <div className={styles.formGoals__badges}>
                {badges?.map((badge) => (
                    <Badge key={badge} variant={"secondary"}>
                        {badge}
                    </Badge>
                ))}
            </div>
        </>
    );
}
