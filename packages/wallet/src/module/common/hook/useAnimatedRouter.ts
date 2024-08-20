"use client";

import { useRouter } from "next/navigation";
import NProgress from "nprogress";

export function useAnimatedRouter() {
    const router = useRouter();

    const navigateWithTransition = async (url: string) => {
        NProgress.start();
        if (document?.startViewTransition) {
            const transition = document.startViewTransition(() =>
                router.push(url)
            );
            await transition.finished;
        } else {
            router.push(url);
        }
    };

    return { navigateWithTransition };
}
