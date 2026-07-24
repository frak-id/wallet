// Compile-time-only parity check between the backend's `EstimatedRewardItem`
// (services/backend/src/domain/campaign/schemas/index.ts, driven by the
// runtime-validated `EstimatedRewardItemSchema`) and the SDK's published
// `MerchantReward` (sdk/core/src/types/rpc/merchantInformation.ts) — the wire
// contract of `GET /user/merchant/estimated-rewards`. Catches the exact class
// of drift that motivated this file: a field added to one side (e.g.
// `productScope`) and silently forgotten on the other.
//
// Zero runtime cost: nothing here is imported or executed, only typechecked.
// Isolated in its own file (rather than inline in `schemas/index.ts`) so this
// checkout's unbuilt `@frak-labs/core-sdk` workspace package (10 pre-existing
// tsc errors, tracked in docs/product-scoped-campaigns-decisions.md) only
// breaks this one file locally; CI, where the SDK package is built, still
// typechecks the real assertion.
//
// Two-part check:
//   1. `_AssertNoKeysOnlyOnOneSide` — the two types expose exactly the same
//      field names. Plain `A extends B` can't catch this alone: TS's
//      structural `extends` has no excess-property checking, so a type with
//      an extra *optional* field still `extends` one without it in both
//      directions — verified empirically before relying on it here.
//   2. `_AssertFieldsMutuallyAssignable` — per shared key, each side's field
//      type is mutually assignable to the other's. This tolerates deliberate
//      narrowing on one side only — e.g. `percentOf`/`tierField` are bare
//      `string` on the backend's wire schema (`t.String()`, never enumerated
//      at that layer) but a tighter, still backend-assignable union on the
//      SDK — while still failing on a genuine shape mismatch (dropped union
//      member, wrong primitive, changed optionality).
//
// `interactionTypeKey` is excluded from both checks: the backend types it as
// bare `string` while the SDK's `InteractionTypeKey` is a closed union incl.
// `` `custom.${string}` ``; the backend's actual runtime values
// (`CampaignTrigger`) use bare `"custom"`, not `custom.${string}` — a
// pre-existing mismatch, out of scope for this parity check.
import type { MerchantReward } from "@frak-labs/core-sdk";
import type { EstimatedRewardItem } from "./index";

type BackendItem = Omit<EstimatedRewardItem, "interactionTypeKey">;
type SdkItem = Omit<MerchantReward, "interactionTypeKey">;

type Expect<T extends true> = T;

type OnlyInBackend = Exclude<keyof BackendItem, keyof SdkItem>;
type OnlyInSdk = Exclude<keyof SdkItem, keyof BackendItem>;

type _AssertNoKeysOnlyOnOneSide = Expect<
    [OnlyInBackend, OnlyInSdk] extends [never, never] ? true : false
>;

type SharedKey = keyof BackendItem & keyof SdkItem;
type MutuallyAssignable<K extends SharedKey> = BackendItem[K] extends SdkItem[K]
    ? SdkItem[K] extends BackendItem[K]
        ? true
        : false
    : false;

type MismatchedField = {
    [K in SharedKey]: MutuallyAssignable<K> extends true ? never : K;
}[SharedKey];

type _AssertFieldsMutuallyAssignable = Expect<
    MismatchedField extends never ? true : false
>;
