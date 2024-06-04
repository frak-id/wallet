"use client";

import { DatePicker } from "@/module/common/component/DatePicker";
import { Panel } from "@/module/common/component/Panel";
import { CheckboxWithLabel } from "@/module/forms/Checkbox";
import { Label } from "@/module/forms/Label";
import { useState } from "react";

export function Schedule() {
    const [isEndDate, setIsEndDate] = useState<boolean | "indeterminate">(
        "indeterminate"
    );

    return (
        <Panel title="Schedule">
            <p>Schedule</p>
            <p>
                You can choose to run your ads continuously, starting today, or
                only during a specific period.
            </p>

            <p>Using a global campaign budget</p>
            <p>
                Ad set schedules affect the allocation of an overall campaign
                budget. Days with greater opportunities have a higher budget. As
                a result, the amount spent daily will fluctuate.
            </p>

            <p>
                <Label htmlFor="start-date">Start date</Label>
            </p>
            <DatePicker />
            <p>End date</p>
            <CheckboxWithLabel
                label={<>Create an end date</>}
                id="end-date"
                onCheckedChange={setIsEndDate}
            />
            {isEndDate === true && <DatePicker />}
        </Panel>
    );
}
