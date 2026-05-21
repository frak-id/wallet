import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { Badge } from "@/module/common/component/Badge";
import { FormDescription, FormItem } from "@/module/forms/Form";
import type {
    ConditionGroup,
    RuleCondition,
    RuleConditions,
} from "@/types/Campaign";
import * as styles from "./campaign-conditions.css";

const operatorLabels: Record<string, string> = {
    eq: "=",
    neq: "≠",
    gt: ">",
    gte: "≥",
    lt: "<",
    lte: "≤",
    in: "in",
    not_in: "not in",
    contains: "contains",
    starts_with: "starts with",
    ends_with: "ends with",
    exists: "exists",
    not_exists: "does not exist",
    between: "between",
};

function isConditionGroup(
    condition: RuleCondition | ConditionGroup
): condition is ConditionGroup {
    return "logic" in condition && "conditions" in condition;
}

function formatValue(field: string, value: string | number | boolean | null) {
    if (value === null) return "null";
    if (typeof value === "boolean") return value ? "true" : "false";

    if (field === "time.timestamp" && typeof value === "number") {
        return new Date(value * 1000).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    return String(value);
}

function ConditionItem({ condition }: { condition: RuleCondition }) {
    const operatorLabel =
        operatorLabels[condition.operator] ?? condition.operator;
    const fieldLabel = condition.field.replace(/\./g, " › ");

    return (
        <div className={styles.conditionsItem}>
            <Badge variant={"secondary"}>{fieldLabel}</Badge>
            <Text
                as="span"
                variant="bodySmall"
                color="secondary"
                weight="medium"
            >
                {operatorLabel}
            </Text>
            {condition.operator === "between" ? (
                <>
                    <Badge variant={"secondary"}>
                        {formatValue(condition.field, condition.value)}
                    </Badge>
                    <Text
                        as="span"
                        variant="bodySmall"
                        color="secondary"
                        weight="medium"
                    >
                        and
                    </Text>
                    <Badge variant={"secondary"}>
                        {formatValue(
                            condition.field,
                            condition.valueTo ?? null
                        )}
                    </Badge>
                </>
            ) : condition.operator !== "exists" &&
              condition.operator !== "not_exists" ? (
                <Badge variant={"secondary"}>
                    {formatValue(condition.field, condition.value)}
                </Badge>
            ) : null}
        </div>
    );
}

function ConditionGroupDisplay({ group }: { group: ConditionGroup }) {
    if (group.conditions.length === 0) return null;

    const logicLabel =
        group.logic === "all"
            ? "All of"
            : group.logic === "any"
              ? "Any of"
              : "None of";

    return (
        <div className={styles.conditionsGroup}>
            <span className={styles.conditionsLogic}>{logicLabel}:</span>
            <div className={styles.conditionsGroupItems}>
                {group.conditions.map((condition, index) => {
                    if (isConditionGroup(condition)) {
                        return (
                            <ConditionGroupDisplay
                                key={`group-${index}`}
                                group={condition}
                            />
                        );
                    }
                    return (
                        <ConditionItem
                            key={`${condition.field}-${index}`}
                            condition={condition}
                        />
                    );
                })}
            </div>
        </div>
    );
}

export function CampaignConditions({
    conditions,
}: {
    conditions: RuleConditions;
}) {
    if (Array.isArray(conditions)) {
        if (conditions.length === 0) return null;

        return (
            <FormItem>
                <FormDescription label="Conditions" />
                <Stack space="m">
                    <Stack space="xs">
                        {conditions.map((condition, index) => (
                            <ConditionItem
                                key={`${condition.field}-${index}`}
                                condition={condition}
                            />
                        ))}
                    </Stack>
                </Stack>
            </FormItem>
        );
    }

    if (conditions.conditions.length === 0) return null;

    return (
        <FormItem>
            <FormDescription label="Conditions" />
            <Stack space="m">
                <ConditionGroupDisplay group={conditions} />
            </Stack>
        </FormItem>
    );
}
