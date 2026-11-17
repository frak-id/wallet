import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@frak-labs/design-system/components/AlertDialog";
import { Button } from "@frak-labs/design-system/components/Button";
import { ConfirmationTooltip } from "@frak-labs/design-system/components/ConfirmationTooltip";
import {
    DetailSheet,
    DetailSheetActions,
    DetailSheetBody,
    DetailSheetFooter,
    DetailSheetHero,
} from "@frak-labs/design-system/components/DetailSheet";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@frak-labs/design-system/components/Dialog";
import {
    Drawer,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTrigger,
} from "@frak-labs/design-system/components/Drawer";
import { GlassButton } from "@frak-labs/design-system/components/GlassButton";
import { GlassCloseButton } from "@frak-labs/design-system/components/GlassCloseButton";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@frak-labs/design-system/components/Popover";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ToastSurface } from "@frak-labs/design-system/components/ToastSurface";
import { ShareIcon } from "@frak-labs/design-system/icons";
import { type ComponentProps, useState } from "react";
import { fixtures, longText } from "../fixtures";
import { heroImage, phoneFrame, toastFrame, toastOffset } from "../gallery.css";
import { Case, Cases } from "../ui";

/** Marks the control the spec presses Enter on to open an overlay. */
const openTrigger = { "data-gallery-open": "" };

type DialogLayer = ComponentProps<typeof DialogContent>["layer"];

function DialogCase({
    name,
    title,
    body,
    layer,
}: {
    name: string;
    title: string;
    body: string;
    layer?: DialogLayer;
}) {
    return (
        <Case name={name}>
            <Dialog>
                <DialogTrigger asChild>
                    <Button width="auto" {...openTrigger}>
                        Open {name}
                    </Button>
                </DialogTrigger>
                <DialogContent layer={layer}>
                    <Stack space="m">
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>{body}</DialogDescription>
                        <Stack space="xs">
                            <Button>Confirm</Button>
                            <DialogClose asChild>
                                <Button variant="secondary">Cancel</Button>
                            </DialogClose>
                        </Stack>
                    </Stack>
                </DialogContent>
            </Dialog>
        </Case>
    );
}

export function DialogSection() {
    return (
        <>
            <Cases title="Layers">
                <DialogCase
                    name="default"
                    title="Remove this card?"
                    body="You can add it again later from your settings."
                />
                <DialogCase
                    name="layer top"
                    title="Confirm it's you"
                    body="Use your passkey to continue."
                    layer="top"
                />
            </Cases>
            <Cases title="Worst case">
                <DialogCase
                    name="worst: unbreakable email"
                    title={fixtures.unbreakableEmail}
                    body={fixtures.unbreakableEmail}
                />
                <DialogCase
                    name="worst: long sentence"
                    title={fixtures.longSentence}
                    body={longText(4)}
                />
            </Cases>
        </>
    );
}

type DrawerContentProps = ComponentProps<typeof DrawerContent>;

function DrawerCase({
    name,
    title,
    body,
    ...content
}: {
    name: string;
    title: string;
    body: string;
} & Pick<DrawerContentProps, "surface" | "edgeToEdge">) {
    return (
        <Case name={name}>
            <Drawer>
                <DrawerTrigger asChild>
                    <Button width="auto" {...openTrigger}>
                        Open {name}
                    </Button>
                </DrawerTrigger>
                <DrawerContent {...content}>
                    <Stack space="m">
                        <DrawerHeader>
                            <Text variant="heading4">{title}</Text>
                            <Text color="secondary">{body}</Text>
                        </DrawerHeader>
                        <DrawerFooter>
                            <Button>Continue</Button>
                        </DrawerFooter>
                    </Stack>
                </DrawerContent>
            </Drawer>
        </Case>
    );
}

export function DrawerSection() {
    return (
        <>
            <Cases title="Surfaces">
                <DrawerCase
                    name="default"
                    title="Sort by"
                    body="Pick the order of the list."
                />
                <DrawerCase
                    name="surface muted"
                    title="Sort by"
                    body="Pick the order of the list."
                    surface="muted"
                />
                <DrawerCase
                    name="edge to edge"
                    title="Sort by"
                    body="Pick the order of the list."
                    edgeToEdge
                />
            </Cases>
            <Cases title="Worst case">
                <DrawerCase
                    name="worst: unbreakable email"
                    title={fixtures.unbreakableEmail}
                    body={fixtures.unbreakableEmail}
                />
                <DrawerCase
                    name="worst: long content"
                    title={fixtures.longSentence}
                    body={longText(30)}
                />
            </Cases>
        </>
    );
}

function SheetActions() {
    return (
        <DetailSheetActions>
            <GlassCloseButton aria-label="Close" onClick={() => {}} />
            <GlassButton
                as="button"
                aria-label="Share"
                icon={<ShareIcon width={22} height={22} />}
            />
        </DetailSheetActions>
    );
}

function SheetCase({
    name,
    title,
    surface,
    hero = "image",
}: {
    name: string;
    title: string;
    hero?: "image" | "overlay";
} & ComponentProps<typeof DetailSheet>) {
    return (
        <Case name={name}>
            <div className={phoneFrame}>
                <DetailSheet surface={surface}>
                    {hero === "image" ? (
                        <DetailSheetHero height={200}>
                            <div className={heroImage} />
                            <SheetActions />
                        </DetailSheetHero>
                    ) : (
                        <DetailSheetHero height={200} surface="overlay">
                            <SheetActions />
                        </DetailSheetHero>
                    )}
                    <DetailSheetBody>
                        <Stack space="xs">
                            <Text variant="heading4">{title}</Text>
                            <Text color="secondary">
                                Earn up to 20 € for each friend who buys.
                            </Text>
                        </Stack>
                    </DetailSheetBody>
                    <DetailSheetFooter>
                        <Button>Share the offer</Button>
                    </DetailSheetFooter>
                </DetailSheet>
            </div>
        </Case>
    );
}

export function DetailSheetSection() {
    return (
        <>
            <Cases title="Hero">
                <SheetCase name="hero image" title="Le Petit Café" />
                <SheetCase
                    name="hero overlay"
                    title="Le Petit Café"
                    hero="overlay"
                />
                <SheetCase
                    name="surface background2"
                    title="Le Petit Café"
                    surface="background2"
                />
            </Cases>
            <Cases title="Worst case">
                <SheetCase
                    name="worst: unbreakable email"
                    title={fixtures.unbreakableEmail}
                />
                <SheetCase
                    name="worst: non-Latin and emoji"
                    title={fixtures.nonLatin}
                />
            </Cases>
        </>
    );
}

function ToastCase({
    name,
    label,
    offset,
}: {
    name: string;
    label: string;
    offset?: boolean;
}) {
    return (
        <Case name={name}>
            <div className={toastFrame}>
                <ToastSurface className={offset ? toastOffset : undefined}>
                    <ConfirmationTooltip>{label}</ConfirmationTooltip>
                </ToastSurface>
            </div>
        </Case>
    );
}

export function ToastSurfaceSection() {
    return (
        <>
            <Cases title="Placement">
                <ToastCase name="top center" label="Referral code applied" />
                <ToastCase
                    name="top offset"
                    label="Referral code applied"
                    offset
                />
            </Cases>
            <Cases title="Worst case" layout="stack">
                <ToastCase
                    name="worst: unbreakable email"
                    label={fixtures.unbreakableEmail}
                />
                <ToastCase
                    name="worst: long sentence"
                    label={fixtures.longSentence}
                />
            </Cases>
        </>
    );
}

function ResponsiveModalCase({
    name,
    title,
    body,
}: {
    name: string;
    title: string;
    body: string;
}) {
    const [open, setOpen] = useState(false);
    return (
        <Case name={name}>
            <Button width="auto" onClick={() => setOpen(true)} {...openTrigger}>
                Open {name}
            </Button>
            <ResponsiveModal
                open={open}
                onOpenChange={setOpen}
                title={title}
                description={body}
                header={<Text variant="heading4">{title}</Text>}
            >
                <Stack space="m">
                    <Text color="secondary">{body}</Text>
                    <Button onClick={() => setOpen(false)}>Got it</Button>
                </Stack>
            </ResponsiveModal>
        </Case>
    );
}

export function ResponsiveModalSection() {
    return (
        <>
            <Cases title="Default">
                <ResponsiveModalCase
                    name="default"
                    title="Nothing to transfer"
                    body="Your balance is empty for now."
                />
            </Cases>
            <Cases title="Worst case">
                <ResponsiveModalCase
                    name="worst: unbreakable email"
                    title={fixtures.unbreakableEmail}
                    body={fixtures.unbreakableEmail}
                />
                <ResponsiveModalCase
                    name="worst: long content"
                    title={fixtures.longSentence}
                    body={longText(30)}
                />
            </Cases>
        </>
    );
}

type SheetContentProps = ComponentProps<typeof SheetContent>;

function SheetPanelCase({
    name,
    title,
    body,
    ...content
}: {
    name: string;
    title: string;
    body: string;
} & Pick<SheetContentProps, "side" | "size">) {
    return (
        <Case name={name}>
            <Sheet>
                <SheetTrigger asChild>
                    <Button width="auto" {...openTrigger}>
                        Open {name}
                    </Button>
                </SheetTrigger>
                <SheetContent {...content}>
                    <SheetHeader>
                        <SheetTitle>{title}</SheetTitle>
                        <SheetDescription>{body}</SheetDescription>
                    </SheetHeader>
                    <SheetFooter>
                        <Button>Save</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </Case>
    );
}

export function SheetSection() {
    return (
        <>
            <Cases title="Sides">
                {(["right", "left", "top", "bottom"] as const).map((side) => (
                    <SheetPanelCase
                        key={side}
                        name={`side ${side}`}
                        title="Campaign details"
                        body="Edit the budget and the dates."
                        side={side}
                    />
                ))}
                <SheetPanelCase
                    name="size wide"
                    title="Campaign details"
                    body="Edit the budget and the dates."
                    size="wide"
                />
            </Cases>
            <Cases title="Worst case">
                <SheetPanelCase
                    name="worst: unbreakable email"
                    title={fixtures.unbreakableEmail}
                    body={fixtures.unbreakableEmail}
                />
                <SheetPanelCase
                    name="worst: long content"
                    title={fixtures.longSentence}
                    body={longText(30)}
                />
            </Cases>
        </>
    );
}

function PopoverCase({ name, body }: { name: string; body: string }) {
    return (
        <Case name={name}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button width="auto" variant="secondary" {...openTrigger}>
                        Open {name}
                    </Button>
                </PopoverTrigger>
                <PopoverContent>
                    <Stack space="s">
                        <Text>{body}</Text>
                        <Button size="small">Apply</Button>
                    </Stack>
                </PopoverContent>
            </Popover>
        </Case>
    );
}

export function PopoverSection() {
    return (
        <>
            <Cases title="Default">
                <PopoverCase name="default" body="Filter by status." />
            </Cases>
            <Cases title="Worst case">
                <PopoverCase
                    name="worst: unbreakable email"
                    body={fixtures.unbreakableEmail}
                />
                <PopoverCase name="worst: long sentence" body={longText(4)} />
            </Cases>
        </>
    );
}

function AlertDialogCase({
    name,
    title,
    body,
    action = "Delete",
}: {
    name: string;
    title: string;
    body: string;
    action?: string;
}) {
    return (
        <Case name={name}>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button width="auto" variant="destructive" {...openTrigger}>
                        Open {name}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <Stack space="m">
                        <Stack space="xs">
                            <AlertDialogTitle>{title}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {body}
                            </AlertDialogDescription>
                        </Stack>
                        <Stack space="xs">
                            <AlertDialogAction asChild>
                                <Button variant="destructive">{action}</Button>
                            </AlertDialogAction>
                            <AlertDialogCancel asChild>
                                <Button variant="secondary">Cancel</Button>
                            </AlertDialogCancel>
                        </Stack>
                    </Stack>
                </AlertDialogContent>
            </AlertDialog>
        </Case>
    );
}

export function AlertDialogSection() {
    return (
        <>
            <Cases title="Default">
                <AlertDialogCase
                    name="default"
                    title="Delete this campaign?"
                    body="This cannot be undone."
                />
            </Cases>
            <Cases title="Worst case">
                <AlertDialogCase
                    name="worst: unbreakable email"
                    title={fixtures.unbreakableEmail}
                    body={fixtures.unbreakableEmail}
                    action={fixtures.unbreakableEmail}
                />
                <AlertDialogCase
                    name="worst: long sentence"
                    title={fixtures.longSentence}
                    body={longText(4)}
                    action={fixtures.longSentence}
                />
                <AlertDialogCase
                    name="worst: non-Latin and emoji"
                    title={fixtures.nonLatin}
                    body={fixtures.nonLatin}
                />
            </Cases>
        </>
    );
}
