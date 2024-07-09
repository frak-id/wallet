import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { ButtonProduct } from "@/module/dashboard/component/ButtonProduct";
import { useMintMyContent } from "@/module/dashboard/hooks/useMintMyContent";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import { AuthFingerprint } from "@module/component/AuthFingerprint";
import { Button } from "@module/component/Button";
import { validateUrl } from "@module/utils/validateUrl";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { BadgeCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import styles from "./index.module.css";

type ProductNew = {
    name: string;
    domain: string;
};

const isModalOpenAtom = atom(false);
const successAtom = atom(false);
const stepAtom = atom(1);
const resetAtom = atom(null, (_get, set) => {
    set(stepAtom, 1);
    set(successAtom, false);
});

export function Home() {
    const success = useAtomValue(successAtom);
    const [step, setStep] = useAtom(stepAtom);
    const [isModalOpen, setIsModalOpen] = useAtom(isModalOpenAtom);

    const form = useForm<ProductNew>({
        defaultValues: {
            name: "",
            domain: "",
        },
    });

    return (
        <Panel variant={"ghost"} title={"My Products"}>
            <Form {...form}>
                <form>
                    <AlertDialog
                        open={isModalOpen}
                        onOpenChange={setIsModalOpen}
                        title={
                            <>
                                <BadgeCheck color={"#0DDB84"} /> List a New
                                Product
                            </>
                        }
                        buttonElement={
                            <ButtonProduct>
                                +<br />
                                List a Product
                            </ButtonProduct>
                        }
                        showCloseButton={false}
                        text={
                            <>
                                {step === 1 && <NewProductForm {...form} />}
                                {step === 2 && (
                                    <NewProductVerify
                                        domain={form.getValues().domain}
                                    />
                                )}
                            </>
                        }
                        cancel={
                            step === 1 ? (
                                <Button variant={"outline"}>Cancel</Button>
                            ) : undefined
                        }
                        action={
                            step === 1 ? (
                                <Button
                                    variant={"information"}
                                    disabled={!success}
                                    onClick={() => setStep(2)}
                                >
                                    Next
                                </Button>
                            ) : undefined
                        }
                    />
                </form>
            </Form>
        </Panel>
    );
}

function NewProductForm(form: UseFormReturn<ProductNew>) {
    const isModalOpen = useAtomValue(isModalOpenAtom);
    const [success, setSuccess] = useAtom(successAtom);
    const resetAtoms = useSetAtom(resetAtom);
    const [error, setError] = useState<string | undefined>();
    const { mutateAsync: triggerMintMyContent } = useMintMyContent();

    useEffect(() => {
        if (!isModalOpen) return;

        form.reset();
        setError(undefined);
        resetAtoms();
    }, [isModalOpen, form.reset, resetAtoms]);

    async function verifyDomain() {
        // Reset the error and success states
        setError(undefined);
        setSuccess(false);

        // Trigger the form validation
        const isFormValid = await form.trigger();
        if (!isFormValid) return;

        // Parse the domain name to get the hostname
        const domain = form.getValues().domain;
        const parsedDomain = parseUrl(domain);

        // Trigger the minting of the content
        const { error, success } = await triggerMintMyContent({
            name: form.getValues().name,
            domain: parsedDomain.hostname,
        });
        error && setError(handleError(error, domain));
        success && setSuccess(true);
    }

    return (
        <>
            <p className={styles.newProductForm__introduction}>
                To list a new product, you must enter the domain name of the
                website where the SDK has been installed.
            </p>
            <FormField
                control={form.control}
                name="name"
                rules={{
                    required: "Invalid product name",
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            Enter a Product Name
                        </FormLabel>
                        <FormControl>
                            <Input
                                length={"medium"}
                                placeholder={"Product Name...."}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="domain"
                rules={{
                    required: "Missing domain name",
                    validate: {
                        required: (value) =>
                            validateUrl(value) || "Invalid domain name",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            Enter your Domain Name
                        </FormLabel>
                        <FormControl>
                            <Row>
                                <Input
                                    length={"medium"}
                                    placeholder={"Domain Name...."}
                                    {...field}
                                />
                                <Button
                                    variant={"submit"}
                                    onClick={() => verifyDomain()}
                                >
                                    Verify
                                </Button>
                            </Row>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            {error && <p className={"error"}>{error}</p>}
            {success && (
                <p className={"success"}>
                    Your domain name was successfully verified
                </p>
            )}
        </>
    );
}

function NewProductVerify({ domain }: { domain: string }) {
    const parsedDomain = parseUrl(domain);

    return (
        <div>
            <p className={styles.newProductForm__introduction}>
                <strong>Verify your information</strong>
            </p>
            <p className={styles.newProductForm__verify}>
                I confirm that I want to list the following domain name :<br />
                Domain name: <strong>{parsedDomain.hostname}</strong>
                <br />
                Uri: <strong>{parsedDomain.href}</strong>
            </p>
            <AuthFingerprint className={styles.newProductForm__fingerprint}>
                Validate you Product
            </AuthFingerprint>
        </div>
    );
}

function parseUrl(domain: string) {
    try {
        // Try to parse the URL as-is
        return new URL(domain);
    } catch {
        // If parsing fails, try adding 'https://' prefix
        return new URL(`https://${domain}`);
    }
}

function handleError(error: string, domain: string) {
    if (error.includes("ENODATA")) {
        return `The DNS txt record is not set for the domain ${domain}`;
    }
    return error;
}
