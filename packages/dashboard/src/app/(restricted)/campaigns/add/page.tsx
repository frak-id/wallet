import { Schedule } from "@/module/campaigns/component/Schedule";
import { Territory } from "@/module/campaigns/component/Territory";
import { Button } from "@/module/common/component/Button";
import { Column } from "@/module/common/component/Column";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { Actions } from "@/module/forms/Actions";
import { CheckboxList } from "@/module/forms/CheckboxList";
import { FormLayout } from "@/module/forms/FormLayout";
import { Input } from "@/module/forms/Input";
import { Label } from "@/module/forms/Label";
import { RadioList } from "@/module/forms/RadioList";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/module/forms/Select";
import { X } from "lucide-react";

export default function CampaignsAddPage() {
    return (
        <FormLayout>
            <Head
                title={{ content: "Create a new campaign", size: "small" }}
                rightSection={
                    <Button variant={"outline"} leftIcon={<X size={20} />}>
                        Cancel
                    </Button>
                }
            />
            <Panel title="Campaign Title">
                <Input placeholder={"New awareness campaign"} />
            </Panel>
            <Panel title="Goals">
                <Column>
                    <p>Type of order</p>
                    <Select>
                        <SelectTrigger>
                            <SelectValue placeholder="Select an order" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="auctions">Auctions</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </Column>
                <Column>
                    <p>Campaign goal</p>
                    <RadioList />
                </Column>
            </Panel>
            <Panel title="Special advertising categories">
                <p>
                    Declare whether your ads concern credit, employment, housing
                    or a social, electoral or political issue. Criteria differ
                    from country to country.
                </p>
                <CheckboxList />
            </Panel>
            <Panel title="Budget">
                <p>
                    The campaign budget will allocate this to your currently
                    running ad sets for best results based on your choices and
                    bidding strategy (performance target). You can control
                    spending on a daily or global basis.
                </p>
                <Row>
                    <p>
                        <Label htmlFor="budget-select">Campaign budget</Label>
                        <Select>
                            <SelectTrigger id={"budget-select"}>
                                <SelectValue placeholder="Select a budget" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="daily">
                                    Daily budget
                                </SelectItem>
                                <SelectItem value="monthly">
                                    Monthly budget
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </p>
                    <p>
                        <Input placeholder={"25,00 €"} rightSection={"EUR"} />
                    </p>
                </Row>
                <p>
                    You will spend an average of €25 per day. Your maximum daily
                    spend is €31.25 and your maximum weekly spend is €175.
                </p>
            </Panel>
            <Territory />
            <Schedule />
            <Actions />
        </FormLayout>
    );
}
