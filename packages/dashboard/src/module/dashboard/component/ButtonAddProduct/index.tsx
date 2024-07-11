import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Row } from "@/module/common/component/Row";
import { ProductItem } from "@/module/dashboard/component/ProductItem";
import {
    useCheckDnsTxtRecordSet,
    useDnsTxtRecordSet,
} from "@/module/dashboard/hooks/dnsRecordHooks";
import { useMintMyContent } from "@/module/dashboard/hooks/useMintMyContent";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { AuthFingerprint } from "@module/component/AuthFingerprint";
import { Button } from "@module/component/Button";
import { Input } from "@module/component/forms/Input";
import { validateUrl } from "@module/utils/validateUrl";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { BadgeCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

export function ButtonAddProduct() {
    const success = useAtomValue(successAtom);
    const [step, setStep] = useAtom(stepAtom);
    const [isModalOpen, setIsModalOpen] = useAtom(isModalOpenAtom);
    const resetAtoms = useSetAtom(resetAtom);

    const form = useForm<ProductNew>({
        defaultValues: {
            name: "",
            domain: "",
        },
    });

    /**
     * Reset the form and the atoms when the modal is closed
     */
    useEffect(() => {
        if (isModalOpen) return;
        form.reset();
        resetAtoms();
    }, [isModalOpen, form.reset, resetAtoms]);

    return (
        <Form {...form}>
            <form>
                <AlertDialog
                    open={isModalOpen}
                    onOpenChange={setIsModalOpen}
                    title={
                        <>
                            <BadgeCheck color={"#0DDB84"} /> List a New Product
                        </>
                    }
                    buttonElement={
                        <Button size={"none"} variant={"ghost"}>
                            <ProductItem>
                                +<br />
                                List a Product
                            </ProductItem>
                        </Button>
                    }
                    showCloseButton={false}
                    text={
                        <>
                            {step === 1 && <NewProductForm {...form} />}
                            {step === 2 && (
                                <NewProductVerify
                                    name={form.getValues().name}
                                    domain={form.getValues().domain}
                                />
                            )}
                        </>
                    }
                    cancel={
                        step === 1 ? (
                            <Button variant={"outline"}>Cancel</Button>
                        ) : (
                            step === 2 &&
                            success && (
                                <Button variant={"outline"}>Close</Button>
                            )
                        )
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
    );
}

/**
 * Initial form to create the product
 * @param form
 * @constructor
 */
function NewProductForm(form: UseFormReturn<ProductNew>) {
    const isModalOpen = useAtomValue(isModalOpenAtom);
    const [success, setSuccess] = useAtom(successAtom);
    const [error, setError] = useState<string | undefined>();

    const rawDomain = form.watch("domain");
    const parsedDomain = useMemo(
        () => parseUrl(rawDomain)?.hostname,
        [rawDomain]
    );

    const { data: dnsRecord, isLoading } = useDnsTxtRecordSet({
        name: form.watch("name"),
        domain: parsedDomain,
        enabled: isModalOpen,
    });

    const { mutateAsync: checkDomainSetup } = useCheckDnsTxtRecordSet();

    /**
     * Reset the error when the modal is opened
     */
    useEffect(() => {
        if (!isModalOpen) return;
        setError(undefined);
    }, [isModalOpen]);

    // Verify the validity of a domain
    async function verifyDomain() {
        // Reset the error and success states
        setError(undefined);
        setSuccess(false);

        // Trigger the form validation
        const isFormValid = await form.trigger();
        if (!isFormValid) return;

        // Ensure we got a domain
        if (!parsedDomain) {
            setError("Invalid domain name");
            return;
        }

        // Check the validity of the domain
        const isValidDomain = await checkDomainSetup({
            name: form.getValues().name,
            domain: parsedDomain,
        });

        if (!isValidDomain) {
            setError(
                `The DNS txt record is not set for the domain ${parsedDomain}`
            );
        } else {
            setSuccess(true);
        }
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

            {dnsRecord && !isLoading && (
                <p>
                    DNS TXT record expected to set for domain validation is:{" "}
                    <br />"{dnsRecord}"
                </p>
            )}

            {error && <p className={"error"}>{error}</p>}
            {success && (
                <p className={"success"}>
                    Your domain name was successfully verified
                </p>
            )}
        </>
    );
}

/**
 * Form post creation, once everything is verified
 * @param name
 * @param domain
 * @constructor
 */
function NewProductVerify({ name, domain }: { name: string; domain: string }) {
    const setIsModalOpen = useSetAtom(isModalOpenAtom);
    const parsedDomain = parseUrl(domain);

    const {
        mutate: triggerMintMyContent,
        isIdle,
        error,
        data,
    } = useMintMyContent();

    useEffect(() => {
        // Slight delay for closing the modal
        setTimeout(() => {
            data && setIsModalOpen(false);
        }, 5_000);
    }, [data, setIsModalOpen]);

    if (!parsedDomain) return null;

    return (
        <div>
            <p className={styles.newProductForm__introduction}>
                <strong>Verify your information</strong>
            </p>
            <p className={styles.newProductForm__verify}>
                I confirm that I want to list "{name}" on the following domain :
                <br />
                <strong>{parsedDomain.hostname}</strong>
                <br />
                Uri: <strong>{parsedDomain.href}</strong>
            </p>
            <AuthFingerprint
                className={styles.newProductForm__fingerprint}
                action={() =>
                    triggerMintMyContent({
                        name,
                        domain: parsedDomain.hostname,
                        // todo: hardcoded type, should be in the sdk
                        contentTypes: 1n << 2n,
                    })
                }
                disabled={!isIdle}
            >
                Validate you Product
            </AuthFingerprint>

            {error && <p className={"error"}>{error.message}</p>}
            {data && (
                <p className={"success"}>
                    Your product has been successfully listed on transaction{" "}
                    <strong>{data.mintTxHash}</strong>
                </p>
            )}
        </div>
    );
}

function parseUrl(domain: string) {
    if (!domain || domain.length === 0) {
        return undefined;
    }
    try {
        // Try to parse the URL as-is
        return new URL(domain);
    } catch {
        // If parsing fails, try adding 'https://' prefix
        return new URL(`https://${domain}`);
    }
}
