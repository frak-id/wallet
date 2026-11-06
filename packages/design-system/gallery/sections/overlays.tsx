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
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ToastSurface } from "@frak-labs/design-system/components/ToastSurface";
import { ShareIcon } from "@frak-labs/design-system/icons";
import type { ComponentProps } from "react";
import { fixtures } from "../fixtures";
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
                    body={fixtures.longSentence.repeat(4)}
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
                    body={fixtures.longSentence.repeat(30)}
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
