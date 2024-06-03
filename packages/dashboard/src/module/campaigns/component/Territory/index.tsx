"use client";

import { Panel } from "@/module/common/component/Panel";
import { Label } from "@/module/forms/Label";
import { MultiSelect } from "@/module/forms/MultiSelect";
import { getCountryDataList } from "countries-list";
import { useState } from "react";

export function Territory() {
    const [_selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);

    return (
        <Panel title="Territory">
            <p>
                Choose a or several countries where your campaign will be
                displayed.
            </p>
            <Label htmlFor="select-countries">Location</Label>
            <MultiSelect
                id={"select-countries"}
                options={getCountryDataList()}
                onValueChange={setSelectedFrameworks}
                placeholder="Select country"
            />
        </Panel>
    );
}
