import { atom } from "jotai";
import { unique } from "radash";
import { type Address, getAddress, isAddressEqual } from "viem";

/**
 * Atom to store the selected members
 */
export const selectedMembersAtom = atom<Address[] | undefined>(undefined);

/**
 * Atom to add a member to the selected members
 */
export const addSelectedMembersAtom = atom(
    null,
    (get, set, address: Address) => {
        const selectedMembers = get(selectedMembersAtom);
        if (selectedMembers) {
            // Deduplicate the selected members
            const newSelectedMembers = [...selectedMembers, address];
            set(selectedMembersAtom, unique(newSelectedMembers, getAddress));
        } else {
            set(selectedMembersAtom, [address]);
        }
    }
);

/**
 * Atom to remove a member from the selected members
 */
export const removeSelectedMembersAtom = atom(
    null,
    (get, set, address: Address) => {
        const selectedMembers = get(selectedMembersAtom);
        if (selectedMembers) {
            set(
                selectedMembersAtom,
                selectedMembers.filter((a) => !isAddressEqual(a, address))
            );
        }
    }
);
