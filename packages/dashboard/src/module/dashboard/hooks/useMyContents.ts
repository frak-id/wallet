import { getMyContents } from "@/context/content/action/getContents";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Hook to get all the current user contents
 */
export function useMyContents() {
    const { data } = useQuery({
        queryKey: ["my-contents"],
        queryFn: () => getMyContents(),
    });

    return useMemo(() => {
        return {
            isEmpty:
                !data ||
                (data.owner.length === 0 && data.operator.length === 0),
            contents: data,
        };
    }, [data]);
}
