import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { type Address, type Hex, zeroAddress } from "viem";

type ContentId = Hex;
type ReferralHistory = {
    contents: { [key: ContentId]: Address };
    lastReferrer: Address;
};

/**
 * Atom representing the referral history
 */
export const referralHistoryAtom = atomWithStorage<ReferralHistory>(
    "referralHistory",
    {
        contents: {},
        lastReferrer: zeroAddress,
    }
);

/**
 * Add a referrer to the history atom
 */
export const addReferrerToHistoryAtom = atom(
    null,
    (
        _get,
        set,
        { referrer, contentId }: { referrer: Address; contentId: Hex }
    ) => {
        set(referralHistoryAtom, (prev) => ({
            ...prev,
            contents: {
                ...prev.contents,
                [contentId]: referrer,
            },
            lastReferrer: referrer,
        }));
    }
);
