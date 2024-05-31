import { Button } from "@/module/common/component/Button";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { FormLayout } from "@/module/forms/FormLayout";
import { Input } from "@/module/forms/Input";
import { Radios } from "@/module/forms/Radios";
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
                <p>Type of order</p>
                <Radios />
            </Panel>
            <Panel title="Special advertising categories">
                <p>
                    Declare whether your ads concern credit, employment, housing
                    or a social, electoral or political issue. Criteria differ
                    from country to country.
                </p>
            </Panel>
        </FormLayout>
    );
}
