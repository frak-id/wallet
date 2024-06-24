"use client";

import { Button } from "@/module/common/component/Button";
import { useWallet } from "@/module/common/hook/useWallet";

export default function RestrictedPage() {
    const { data, launch: doOpen } = useWallet({ action: "open" });

    return (
        <>
            <p>dashboard</p>
            <p>
                <Button onClick={() => doOpen()}>
                    open iframe interaction
                </Button>
            </p>
            {data && <p>response key: {data.key}</p>}
        </>
    );
}
