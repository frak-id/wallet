import { useQuery } from "@tanstack/react-query";

export function useMeasurePing(url: string) {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["ping", url],
        queryFn: async () => {
            const pings: number[] = [];

            for (let i = 0; i < 5; i++) {
                const startTime = performance.now();
                try {
                    await fetch(url, {
                        mode: "no-cors",
                    });
                } catch (e) {
                    console.error(e);
                    continue;
                }
                const endTime = performance.now();
                pings.push(endTime - startTime);

                if (i < 4) {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                }
            }

            if (pings.length === 0) {
                throw new Error("No pings received");
            }

            return {
                lowest: Math.min(...pings),
                highest: Math.max(...pings),
                average: pings.reduce((a, b) => a + b, 0) / pings.length,
                pings,
            };
        },
    });

    return {
        result: data,
        isLoading,
        error,
        refetch,
    };
}
