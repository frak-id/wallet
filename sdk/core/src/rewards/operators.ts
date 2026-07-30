import type { ConditionOperator } from "../types";

/**
 * Classification of {@link ConditionOperator}s by operand shape, shared by the
 * SDK's display matching and the backend's evaluation and publish-time
 * validation. Only the classification is shared — each consumer keeps its own
 * evaluation logic.
 */

/** Operators taking a single scalar operand; an array operand is invalid. */
export const SCALAR_OPERATORS: ReadonlySet<ConditionOperator> = new Set([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "between",
]);

/** Operators requiring an array operand. */
export const ARRAY_OPERATORS: ReadonlySet<ConditionOperator> = new Set([
    "in",
    "not_in",
]);

/** Operators requiring a string operand and a string field value. */
export const STRING_OPERATORS: ReadonlySet<ConditionOperator> = new Set([
    "contains",
    "starts_with",
    "ends_with",
]);

/** Operators taking no operand at all — presence checks. */
export const EXISTENCE_OPERATORS: ReadonlySet<ConditionOperator> = new Set([
    "exists",
    "not_exists",
]);

/**
 * Operators selecting the *complement* of what they name. A `productScope` built
 * from these is near-vacuous as a trigger gate, so the backend requires every
 * reward on such a scope to use a matched-items basis.
 */
export const NEGATIVE_OPERATORS: ReadonlySet<ConditionOperator> = new Set([
    "neq",
    "not_in",
    "not_exists",
]);
