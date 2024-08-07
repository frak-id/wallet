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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/module/forms/Select";
import type { Campaign } from "@/types/Campaign";
import {
    MousePointer,
    RotateCw,
    ShoppingBag,
    User,
    Volume2,
} from "lucide-react";
import { type ReactElement, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import styles from "./FormGoals.module.css";

type ItemGoals = {
    id: string;
    label: string;
    icon: ReactElement;
    information?: {
        title: string;
        description: string;
        badges: string[];
    };
};

const itemsGoals: ItemGoals[] = [
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
    },
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
                "Create more registrations on your media for more qualified data and no longer depend on cookie consent.",
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
                "Find people likely to subscribe or buy content on a pay-per-view basis",
            badges: ["Subscription", "Revenue", "Conversion"],
        },
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
    },
] as const;

export function FormGoals(form: UseFormReturn<Campaign>) {
    const [goal, setGoal] = useState<ItemGoals | undefined>();

    return (
        <Panel title="Goals">
            <Column>
                <FormField
                    control={form.control}
                    name="order"
                    rules={{ required: "Select an order" }}
                    render={({ field }) => (
                        <FormItem>
                            <FormDescription title={"Type of order"} />
                            <FormControl>
                                <Select
                                    name={field.name}
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                >
                                    <SelectTrigger length={"medium"} {...field}>
                                        <SelectValue placeholder="Select an order" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auctions">
                                            Auctions
                                        </SelectItem>
                                        <SelectItem value="other">
                                            Other
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </Column>
            <Column fullWidth={true}>
                <FormField
                    control={form.control}
                    name="type"
                    rules={{ required: "Select a goal" }}
                    render={({ field }) => (
                        <FormItem>
                            <FormDescription title={"Campaign goal"} />
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
                                                        />
                                                    </FormControl>
                                                    <FormLabel
                                                        variant={"radio"}
                                                        className={
                                                            styles.formGoals__label
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
