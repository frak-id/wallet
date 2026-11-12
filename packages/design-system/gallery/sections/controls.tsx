import { Button } from "@frak-labs/design-system/components/Button";
import { Checkbox } from "@frak-labs/design-system/components/Checkbox";
import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { FieldLabel } from "@frak-labs/design-system/components/FieldLabel";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import {
    Stepper,
    type StepperProps,
} from "@frak-labs/design-system/components/Stepper";
import { Switch } from "@frak-labs/design-system/components/Switch";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { Text } from "@frak-labs/design-system/components/Text";
import { TextArea } from "@frak-labs/design-system/components/TextArea";
import { TimeInput } from "@frak-labs/design-system/components/TimeInput";
import { InfoIcon } from "@frak-labs/design-system/icons";
import type { ComponentProps } from "react";
import { fixtures, longText } from "../fixtures";
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

function Radios({
    name,
    labels,
    size,
    ...group
}: {
    name: string;
    labels: readonly string[];
    size?: "m" | "l";
} & ComponentProps<typeof RadioGroup>) {
    return (
        <RadioGroup aria-label={name} {...group}>
            {labels.map((label) => (
                <Inline key={label} space="xs" alignY="center">
                    <RadioGroupItem
                        id={`${name}-${label}`}
                        value={label}
                        size={size}
                    />
                    <label htmlFor={`${name}-${label}`}>
                        <Text as="span">{label}</Text>
                    </label>
                </Inline>
            ))}
        </RadioGroup>
    );
}

const radioLabels = ["Daily", "Weekly", "Monthly"] as const;

export function RadioGroupSection() {
    return (
        <>
            <Cases title="States">
                <Case name="none selected">
                    <Radios name="none selected" labels={radioLabels} />
                </Case>
                <Case name="selected">
                    <Radios
                        name="selected"
                        labels={radioLabels}
                        defaultValue="Weekly"
                    />
                </Case>
                <Case name="disabled">
                    <Radios
                        name="disabled"
                        labels={radioLabels}
                        defaultValue="Daily"
                        disabled
                    />
                </Case>
                <Case name="size l">
                    <Radios
                        name="size l"
                        labels={radioLabels}
                        defaultValue="Monthly"
                        size="l"
                    />
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <Radios
                        name="worst email"
                        labels={[fixtures.unbreakableEmail, "Other"]}
                        defaultValue="Other"
                    />
                </Case>
                <Case name="worst: long sentence">
                    <Radios
                        name="worst sentence"
                        labels={[fixtures.longSentence, "Other"]}
                    />
                </Case>
                <Case name="worst: one option">
                    <Radios name="worst one" labels={["Only"]} />
                </Case>
            </Cases>
        </>
    );
}

export function FieldLabelSection() {
    return (
        <>
            <Cases title="Parts">
                <Case name="label and hint">
                    <FieldLabel
                        label="IBAN"
                        hint="We never share it."
                        htmlFor="field-label-iban"
                    >
                        <Input id="field-label-iban" />
                    </FieldLabel>
                </Case>
                <Case name="label only">
                    <FieldLabel label="Name" htmlFor="field-label-name">
                        <Input id="field-label-name" />
                    </FieldLabel>
                </Case>
                <Case name="hint only">
                    <FieldLabel hint="Optional" htmlFor="field-label-hint">
                        <Input id="field-label-hint" aria-label="Nickname" />
                    </FieldLabel>
                </Case>
            </Cases>
            <Cases title="Reserved lines">
                <Case name="reserve 2 lines">
                    <Inline space="s" alignY="bottom">
                        <FieldLabel
                            label="Short"
                            reserveLabelLines={2}
                            htmlFor="field-label-short"
                        >
                            <Input id="field-label-short" length="small" />
                        </FieldLabel>
                        <FieldLabel
                            label="A label long enough to wrap"
                            reserveLabelLines={2}
                            htmlFor="field-label-long"
                        >
                            <Input id="field-label-long" length="small" />
                        </FieldLabel>
                    </Inline>
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <FieldLabel
                        label={fixtures.unbreakableEmail}
                        hint={fixtures.unbreakableEmail}
                        htmlFor="field-label-worst-email"
                    >
                        <Input id="field-label-worst-email" />
                    </FieldLabel>
                </Case>
                <Case name="worst: long sentence">
                    <FieldLabel
                        label={fixtures.longSentence}
                        hint={fixtures.longSentence}
                        htmlFor="field-label-worst-sentence"
                    >
                        <Input id="field-label-worst-sentence" />
                    </FieldLabel>
                </Case>
            </Cases>
        </>
    );
}

export function FieldErrorSection() {
    return (
        <>
            <Cases title="Roles">
                <Case name="status">
                    <FieldError>Enter a valid IBAN.</FieldError>
                </Case>
                <Case name="alert">
                    <FieldError role="alert">This code has expired.</FieldError>
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <FieldError>{fixtures.unbreakableEmail}</FieldError>
                </Case>
                <Case name="worst: long sentence">
                    <FieldError>{fixtures.longSentence}</FieldError>
                </Case>
                <Case name="worst: one character">
                    <FieldError>{fixtures.singleChar}</FieldError>
                </Case>
                <Case name="worst: non-Latin and emoji">
                    <FieldError>{fixtures.nonLatin}</FieldError>
                </Case>
            </Cases>
        </>
    );
}

type TextAreaProps = ComponentProps<typeof TextArea>;

const textAreaLengths: NonNullable<TextAreaProps["length"]>[] = [
    "small",
    "medium",
    "big",
];

export function TextAreaSection() {
    return (
        <>
            <Cases title="Lengths">
                {textAreaLengths.map((length) => (
                    <Case key={length} name={`length ${length}`}>
                        <TextArea
                            aria-label={length}
                            length={length}
                            placeholder={length}
                        />
                    </Case>
                ))}
            </Cases>
            <Cases title="States">
                <Case name="error">
                    <TextArea aria-label="error" defaultValue="invalid" error />
                </Case>
                <Case name="disabled">
                    <TextArea
                        aria-label="disabled"
                        defaultValue="disabled"
                        disabled
                    />
                </Case>
                <Case name="resize none">
                    <TextArea
                        aria-label="resize none"
                        defaultValue="Fixed size"
                        resize="none"
                    />
                </Case>
                <Case name="label and hint">
                    <TextArea
                        label="Message"
                        hint="Shown to your customers"
                        placeholder="Write something"
                    />
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email value">
                    <TextArea
                        aria-label="email"
                        defaultValue={fixtures.unbreakableEmail}
                    />
                </Case>
                <Case name="worst: long value">
                    <TextArea aria-label="long" defaultValue={longText(6)} />
                </Case>
                <Case name="worst: long placeholder">
                    <TextArea
                        aria-label="placeholder"
                        placeholder={fixtures.longSentence}
                    />
                </Case>
                <Case name="worst: non-Latin and emoji value">
                    <TextArea
                        aria-label="non-Latin"
                        defaultValue={fixtures.nonLatin}
                    />
                </Case>
                <Case name="worst: one-character label, unbreakable hint">
                    <TextArea
                        label={fixtures.singleChar}
                        hint={fixtures.unbreakableEmail}
                    />
                </Case>
            </Cases>
        </>
    );
}

export function TimeInputSection() {
    return (
        <>
            <Cases title="Variants">
                {inputVariants.map((variant) => (
                    <Case key={variant} name={`variant ${variant}`}>
                        <TimeInput
                            variant={variant}
                            aria-label={variant}
                            defaultValue="09:30"
                        />
                    </Case>
                ))}
            </Cases>
            <Cases title="States">
                <Case name="empty">
                    <TimeInput aria-label="empty" />
                </Case>
                <Case name="error">
                    <TimeInput aria-label="error" defaultValue="25:00" error />
                </Case>
                <Case name="disabled">
                    <TimeInput
                        aria-label="disabled"
                        defaultValue="18:45"
                        disabled
                    />
                </Case>
                <Case name="label and hint">
                    <TimeInput
                        label="Send at"
                        hint="Your local time"
                        defaultValue="08:00"
                    />
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: long label and unbreakable hint">
                    <TimeInput
                        label={fixtures.longSentence}
                        hint={fixtures.unbreakableEmail}
                    />
                </Case>
                <Case name="worst: one-character label">
                    <TimeInput label={fixtures.singleChar} />
                </Case>
                <Case name="worst: non-Latin and emoji label">
                    <TimeInput
                        label={fixtures.nonLatin}
                        hint={fixtures.nonLatin}
                    />
                </Case>
            </Cases>
        </>
    );
}

const checkoutSteps: StepperProps["steps"] = [
    { title: "Account", description: "Create your wallet" },
    { title: "Connect", description: "Link your store" },
    { title: "Rewards" },
    { title: "Launch", description: "Go live" },
];

// Clicks must not move the active step: the spec presses every tab stop in turn.
function StepperDemo({
    steps = checkoutSteps,
    initial,
}: {
    steps?: StepperProps["steps"];
    initial: number;
}) {
    return (
        <Stepper steps={steps} activeStep={initial} onStepClick={() => {}} />
    );
}

export function StepperSection() {
    return (
        <>
            <Cases title="Progress" layout="stack">
                <Case name="first step active">
                    <StepperDemo initial={0} />
                </Case>
                <Case name="middle step, completed steps clickable">
                    <StepperDemo initial={2} />
                </Case>
                <Case name="all completed">
                    <StepperDemo initial={checkoutSteps.length} />
                </Case>
                <Case name="read-only">
                    <Stepper steps={checkoutSteps} activeStep={1} />
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <StepperDemo
                        initial={1}
                        steps={[
                            {
                                title: fixtures.unbreakableEmail,
                                description: fixtures.unbreakableEmail,
                            },
                            {
                                title: fixtures.hugeNumber,
                                description: fixtures.hugeNumber,
                            },
                        ]}
                    />
                </Case>
                <Case name="worst: long sentence">
                    <StepperDemo
                        initial={1}
                        steps={[
                            {
                                title: fixtures.longSentence,
                                description: longText(3),
                            },
                            { title: `${fixtures.longSentence} Again` },
                        ]}
                    />
                </Case>
                <Case name="worst: one character and non-Latin">
                    <StepperDemo
                        initial={1}
                        steps={[
                            { title: fixtures.singleChar },
                            {
                                title: fixtures.nonLatin,
                                description: fixtures.nonLatin,
                            },
                        ]}
                    />
                </Case>
            </Cases>
        </>
    );
}
