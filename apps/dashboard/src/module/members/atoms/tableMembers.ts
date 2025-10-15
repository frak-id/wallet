import { atom } from "jotai";
import type { GetMembersParam } from "@/context/members/action/getProductMembers";

/**
 * Atom to store the table members filters
 */
export const tableMembersFiltersAtom = atom<GetMembersParam>({
    limit: 10,
    offset: 0,
});

/**
 * Atom to store the count of the table members filters
 */
export const tableMembersFiltersCountAtom = atom<number>(0);
