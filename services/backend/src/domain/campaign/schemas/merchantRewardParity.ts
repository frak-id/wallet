// Compile-time-only parity check between the backend's `EstimatedRewardItem`
// and the SDK's published `MerchantReward` — the wire contract of
// `GET /user/merchant/estimated-rewards`. Catches a field added to one side and
// forgotten on the other. Nothing here runs; it is only typechecked.
//
// Key names must match exactly: TS's structural `extends` has no excess-property
// checking, so an extra *optional* field still `extends` in both directions.
// Field types only need to be mutually assignable, tolerating deliberate
// narrowing on the SDK side (e.g. `percentOf` is bare `string` on the backend).
//
// `interactionTypeKey` is excluded: the backend types it as bare `string` while
// the SDK uses a closed union — a pre-existing mismatch.
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
