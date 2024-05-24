"use client";

import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Redirect to the profile page
 */
export function ProfileEdit() {
    const router = useRouter();

    return (
        <Panel size={"none"} variant={"empty"}>
            <ButtonRipple
                size={"small"}
                onClick={() => router.push("/membrs/profile")}
            >
                <Row>
                    <Pencil absoluteStrokeWidth={true} size={32} /> Edit your
                    profile
                </Row>
            </ButtonRipple>
        </Panel>
    );
}
