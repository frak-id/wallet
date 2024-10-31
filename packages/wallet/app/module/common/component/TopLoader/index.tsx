import { useFetchers, useNavigation } from "@remix-run/react";
import NProgress from "nprogress";
import nProgressStylesUrl from "nprogress/nprogress.css?url";
import { useEffect, useMemo } from "react";

export function TopLoader() {
    NProgress.configure({ showSpinner: false });
    const navigation = useNavigation();
    const fetchers = useFetchers();

    const state = useMemo<"idle" | "loading">(
        function getGlobalState() {
            const states = [
                navigation.state,
                ...fetchers.map((fetcher) => fetcher.state),
            ];
            if (states.every((state) => state === "idle")) return "idle";
            return "loading";
        },
        [navigation.state, fetchers]
    );

    useEffect(() => {
        if (state === "loading") {
            NProgress.start();
        }

        if (state === "idle") {
            NProgress.done();
        }
    }, [state]);

    return null;
}

export { nProgressStylesUrl };
