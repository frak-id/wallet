import { Button } from "@frak-labs/design-system/components/Button";
import { Checkbox } from "@frak-labs/design-system/components/Checkbox";
import { Input } from "@frak-labs/design-system/components/Input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Switch } from "@frak-labs/design-system/components/Switch";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { InfoIcon } from "@frak-labs/design-system/icons";
import type { ComponentProps } from "react";
import { fixtures } from "../fixtures";
import { Case, Cases } from "../ui";

type ButtonVariant = NonNullable<ComponentProps<typeof Button>["variant"]>;
type ButtonSize = NonNullable<ComponentProps<typeof Button>["size"]>;
type InputProps = ComponentProps<typeof Input>;

const buttonVariants: ButtonVariant[] = [
    "primary",
    "secondary",
    "ghost",
    "destructive",
    "filter",
];
const buttonSizes: ButtonSize[] = [
    "small",
    "medium",
    "large",
    "none",
    "filter",
];

export function ButtonSection() {
    return (
        <>
            <Cases title="Variants">
                {buttonVariants.map((variant) => (
                    <Case key={variant} name={`variant ${variant}`}>
                        <Button variant={variant} width="auto">
                            {variant}
                        </Button>
                    </Case>
                ))}
            </Cases>
            <Cases title="Sizes">
                {buttonSizes.map((size) => (
                    <Case key={size} name={`size ${size}`}>
                        <Button size={size} width="auto">
                            {size}
                        </Button>
                    </Case>
                ))}
            </Cases>
            <Cases title="Disabled">
                {buttonVariants.map((variant) => (
                    <Case key={variant} name={`disabled ${variant}`}>
                        <Button variant={variant} width="auto" disabled>
                            {variant}
                        </Button>
                    </Case>
                ))}
            </Cases>
            <Cases title="States">
                <Case name="loading">
                    <Button width="auto" loading>
                        Loading
                    </Button>
                </Case>
                <Case name="width full in 200px">
                    <div style={{ width: 200 }}>
                        <Button width="full">Full</Button>
                    </div>
                </Case>
                <Case name="font size xl">
                    <Button width="auto" fontSize="xl" size="medium">
                        Big
                    </Button>
                </Case>
            </Cases>
            <Cases title="Icons and Links">
                <Case name="icons">
                    <Button
                        width="auto"
                        icon={<InfoIcon width={20} height={20} />}
                        rightIcon={<InfoIcon width={20} height={20} />}
                    >
                        Both
                    </Button>
                </Case>
                <Case name="as link">
                    <Button
                        as="a"
                        href="#link"
                        width="auto"
                        variant="secondary"
                    >
                        Link
                    </Button>
                </Case>
                <Case name="as link disabled">
                    <Button
                        as="a"
                        href="#link"
                        width="auto"
                        aria-disabled="true"
                    >
                        Link
                    </Button>
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <Button width="auto">{fixtures.unbreakableEmail}</Button>
                </Case>
                <Case name="worst: long sentence">
                    <Button width="auto">{fixtures.longSentence}</Button>
                </Case>
                <Case name="worst: one character">
                    <Button width="auto">{fixtures.singleChar}</Button>
                </Case>
                <Case name="worst: huge number">
                    <Button width="auto">{fixtures.hugeNumber}</Button>
                </Case>
                <Case name="worst: non-Latin and emoji">
                    <Button width="auto">{fixtures.nonLatin}</Button>
                </Case>
            </Cases>
        </>
    );
}

const inputVariants: NonNullable<InputProps["variant"]>[] = [
    "default",
    "bare",
    "soft",
];

export function InputSection() {
    return (
        <>
            <Cases title="Variants">
                {inputVariants.map((variant) => (
                    <Case key={variant} name={`variant ${variant}`}>
                        <Input
                            variant={variant}
                            aria-label={variant}
                            placeholder={variant}
                        />
                    </Case>
                ))}
            </Cases>
            <Cases title="Errors">
                {inputVariants.map((variant) => (
                    <Case key={variant} name={`error ${variant}`}>
                        <Input
                            variant={variant}
                            aria-label={`error ${variant}`}
                            defaultValue="invalid"
                            error
                        />
                    </Case>
                ))}
            </Cases>
            <Cases title="Disabled">
                {inputVariants.map((variant) => (
                    <Case key={variant} name={`disabled ${variant}`}>
                        <Input
                            variant={variant}
                            aria-label={`disabled ${variant}`}
                            defaultValue="disabled"
                            disabled
                        />
                    </Case>
                ))}
            </Cases>
            <Cases title="Lengths">
                {(["small", "medium", "big"] as const).map((length) => (
                    <Case key={length} name={`length ${length}`}>
                        <div>
                            <Input aria-label={length} length={length} />
                        </div>
                    </Case>
                ))}
            </Cases>
            <Cases title="Tone, Labels and Slots">
                <Case name="bare tone muted">
                    <Input
                        variant="bare"
                        tone="muted"
                        aria-label="muted"
                        placeholder="muted"
                    />
                </Case>
                <Case name="label and hint">
                    <Input label="Email" hint="We never share it" />
                </Case>
                <Case name="sections">
                    <Input
                        aria-label="sections"
                        leftSection={<InfoIcon width={20} height={20} />}
                        rightSection={<InfoIcon width={20} height={20} />}
                    />
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email value">
                    <Input
                        aria-label="email"
                        defaultValue={fixtures.unbreakableEmail}
                    />
                </Case>
                <Case name="worst: long placeholder">
                    <Input
                        aria-label="placeholder"
                        placeholder={fixtures.longSentence}
                    />
                </Case>
                <Case name="worst: non-Latin and emoji value">
                    <Input
                        aria-label="non-Latin"
                        defaultValue={fixtures.nonLatin}
                    />
                </Case>
                <Case name="worst: one-character label, unbreakable hint">
                    <Input
                        label={fixtures.singleChar}
                        hint={fixtures.unbreakableEmail}
                    />
                </Case>
            </Cases>
        </>
    );
}

function Pick({
    label,
    ...props
}: ComponentProps<typeof SelectTrigger> & { label: string }) {
    return (
        <Select defaultValue="one">
            <SelectTrigger aria-label={label} {...props}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="one">One</SelectItem>
                <SelectItem value="two">Two</SelectItem>
            </SelectContent>
        </Select>
    );
}

export function SelectSection() {
    return (
        <>
            <Cases title="Variants">
                <Case name="default">
                    <Pick label="default" />
                </Case>
                <Case name="bare elevated">
                    <Pick label="bare elevated" variant="bare" />
                </Case>
                <Case name="bare muted">
                    <Pick label="bare muted" variant="bare" tone="muted" />
                </Case>
            </Cases>
            <Cases title="Lengths">
                <Case name="length medium">
                    <div>
                        <Pick label="medium" length="medium" />
                    </div>
                </Case>
                <Case name="length big">
                    <Pick label="big" length="big" />
                </Case>
            </Cases>
            <Cases title="States">
                <Case name="placeholder">
                    <Select>
                        <SelectTrigger aria-label="placeholder">
                            <SelectValue placeholder="Choose one" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="one">One</SelectItem>
                        </SelectContent>
                    </Select>
                </Case>
                <Case name="disabled">
                    <Select defaultValue="one" disabled>
                        <SelectTrigger aria-label="disabled">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="one">One</SelectItem>
                        </SelectContent>
                    </Select>
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email selected">
                    <Select defaultValue="long">
                        <SelectTrigger aria-label="email" length="big">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="long">
                                {fixtures.unbreakableEmail}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </Case>
                <Case name="worst: non-Latin and emoji selected">
                    <Select defaultValue="long">
                        <SelectTrigger aria-label="non-Latin" length="big">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="long">
                                {fixtures.nonLatin}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </Case>
            </Cases>
        </>
    );
}

function Segments({
    variant,
    fullWidth,
    labels = ["Overview", "Settings"],
}: {
    variant: "segmented" | "navigation";
    fullWidth?: boolean;
    labels?: string[];
}) {
    return (
        <Tabs defaultValue={labels[0]}>
            <TabsList variant={variant} fullWidth={fullWidth}>
                {labels.map((label) => (
                    <TabsTrigger
                        key={label}
                        value={label}
                        variant={variant}
                        fullWidth={fullWidth}
                    >
                        {label}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}

export function TabsSection() {
    return (
        <>
            <Cases title="Variants">
                <Case name="segmented">
                    <Segments variant="segmented" />
                </Case>
                <Case name="navigation">
                    <Segments variant="navigation" />
                </Case>
            </Cases>
            <Cases title="Full Width">
                <Case name="segmented full width in 280px">
                    <div style={{ width: 280 }}>
                        <Segments variant="segmented" fullWidth />
                    </div>
                </Case>
                <Case name="navigation full width in 280px">
                    <div style={{ width: 280 }}>
                        <Segments variant="navigation" fullWidth />
                    </div>
                </Case>
            </Cases>
            <Cases title="Panel and States">
                <Case name="panel">
                    <Tabs defaultValue="a">
                        <TabsList>
                            <TabsTrigger value="a">Panel</TabsTrigger>
                        </TabsList>
                        <TabsContent value="a">Panel content</TabsContent>
                    </Tabs>
                </Case>
                <Case name="disabled trigger">
                    <Tabs defaultValue="a">
                        <TabsList>
                            <TabsTrigger value="a">Enabled</TabsTrigger>
                            <TabsTrigger value="b" disabled>
                                Disabled
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: five long labels">
                    <Segments
                        variant="segmented"
                        labels={[
                            fixtures.unbreakableEmail,
                            fixtures.nonLatin,
                            fixtures.singleChar,
                            fixtures.hugeNumber,
                            "Another",
                        ]}
                    />
                </Case>
            </Cases>
        </>
    );
}

export function SwitchSection() {
    return (
        <Cases title="States">
            <Case name="off">
                <Switch aria-label="off" />
            </Case>
            <Case name="on">
                <Switch aria-label="on" defaultChecked />
            </Case>
            <Case name="disabled off">
                <Switch aria-label="disabled off" disabled />
            </Case>
            <Case name="disabled on">
                <Switch aria-label="disabled on" disabled defaultChecked />
            </Case>
        </Cases>
    );
}

export function CheckboxSection() {
    return (
        <>
            <Cases title="States">
                <Case name="unchecked">
                    <Checkbox aria-label="unchecked" />
                </Case>
                <Case name="checked">
                    <Checkbox aria-label="checked" defaultChecked />
                </Case>
                <Case name="indeterminate">
                    <Checkbox
                        aria-label="indeterminate"
                        checked="indeterminate"
                    />
                </Case>
                <Case name="disabled unchecked">
                    <Checkbox aria-label="disabled unchecked" disabled />
                </Case>
                <Case name="disabled checked">
                    <Checkbox
                        aria-label="disabled checked"
                        disabled
                        defaultChecked
                    />
                </Case>
            </Cases>
            <Cases title="Sizes">
                <Case name="size l">
                    <Checkbox aria-label="large" size="l" defaultChecked />
                </Case>
            </Cases>
        </>
    );
}
