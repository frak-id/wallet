import type { ConditionOperator } from "../types";

/**
 * Classification of {@link ConditionOperator}s by the shape of operand they
 * accept. Single source of truth shared by every consumer that has to branch
 * on operator kind:
 *
 * - `matchesProductScope` (this package) — advisory, fail-open display matching;
 * - `RuleConditionEvaluator` (backend) — authoritative, fail-closed evaluation;
 * - `CampaignManagementService` (backend) — publish-time validation.
 *
 * Only the *classification* is shared. Each consumer keeps its own evaluation
 * logic deliberately: the backend is free to grow a richer engine (decimal
 * arithmetic, new field sources), while this SDK stays minimal and
 * display-only. What must never drift is which operators exist and what
 * operand shape each one takes — that is what lives here.
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
 * Operators that select the *complement* of what they name. A `productScope`
 * built from these is near-vacuous as a trigger gate (the complement of an
 * exclusion list matches almost any cart), which is why the backend requires
 * every reward on such a scope to use a matched-items basis.
 */
export const NEGATIVE_OPERATORS: ReadonlySet<ConditionOperator> = new Set([
    "neq",
    "not_in",
    "not_exists",
]);
