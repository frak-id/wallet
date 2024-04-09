import { sessionAtom } from "@/module/common/atoms/session";
import type { Session } from "@/types/Session";
import { useHydrateAtoms } from "jotai/utils";
import type { PropsWithChildren } from "react";

export function HydrateAtoms({
    session,
    children,
}: PropsWithChildren<{ session: Session | null }>) {
    useHydrateAtoms([[sessionAtom, session]]);
    return children;
}
