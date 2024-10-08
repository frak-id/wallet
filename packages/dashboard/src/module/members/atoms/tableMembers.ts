import type { GetMembersParam } from "@/context/members/action/getProductMembers";
import { atom } from "jotai";

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
