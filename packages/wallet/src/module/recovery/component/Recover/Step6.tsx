import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import Link from "next/link";

const ACTUAL_STEP = 6;

export function Step6() {
    return (
        <AccordionRecoveryItem actualStep={ACTUAL_STEP} title={"Success"}>
            <p>
                Recovery is successful, you can now{" "}
                <Link href={"/login"}>login</Link>
            </p>
        </AccordionRecoveryItem>
    );
}
