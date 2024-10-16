import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Row } from "@/module/common/component/Row";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { ProductItem } from "@/module/dashboard/component/ProductItem";
import {
    useCheckDomainName,
    useDnsTxtRecordToSet,
} from "@/module/dashboard/hooks/dnsRecordHooks";
import { useMintMyProduct } from "@/module/dashboard/hooks/useMintMyProduct";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { MultiSelect } from "@/module/forms/MultiSelect";
import { productTypesLabel } from "@/module/product/utils/productTypes";
import {
    type ProductTypesKey,
    productTypesMask,
} from "@frak-labs/nexus-sdk/core";
import { AuthFingerprint } from "@module/component/AuthFingerprint";
import { Button } from "@module/component/Button";
import { Spinner } from "@module/component/Spinner";
import { Input } from "@module/component/forms/Input";
import { validateUrl } from "@module/utils/validateUrl";
import { useQuery } from "@tanstack/react-query";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { BadgeCheck, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import type { Hex } from "viem";
import styles from "./index.module.css";

type ProductNew = {
    name: string;
    domain: string;
    productTypes: ProductTypesKey[];
    setupCode: string;
};

const isModalOpenAtom = atom(false);
const successAtom = atom(false);
const isMintingAtom = atom(false);
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
    const isMinting = useAtomValue(isMintingAtom);

    const form = useForm<ProductNew>({
        defaultValues: {
            name: "",
            domain: "",
            productTypes: [],
            setupCode: "",
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
                            <ProductItem
                                name={
                                    <>
                                        <Plus />
                                        List a Product
                                    </>
                                }
                                domain={"domain.com"}
                                showActions={false}
                                isLink={false}
                            />
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
                                    productTypes={form.getValues().productTypes}
                                    setupCode={form.getValues().setupCode}
                                />
                            )}
                        </>
                    }
                    cancel={
                        step === 1 ? (
                            <Button variant={"outline"}>Cancel</Button>
                        ) : (
                            step === 2 && (
                                <Button
                                    variant={"outline"}
                                    disabled={isMinting}
                                >
                                    Close
                                </Button>
                            )
                        )
                    }
                    action={
                        step === 1 ? (
                            <Button
                                variant={"information"}
                                disabled={!(success && form.formState.isValid)}
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

    const domain = form.watch("domain");
    const setupCode = form.watch("setupCode");

    const { data: dnsRecord, isLoading } = useDnsTxtRecordToSet({
        domain,
        enabled: isModalOpen,
    });

    const { mutateAsync: checkDomainSetup } = useCheckDomainName();

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
        if (!domain) {
            setError("Invalid domain name");
            return;
        }

        // Check the validity of the domain
        const { isAlreadyMinted, isRecordSet } = await checkDomainSetup({
            domain,
            setupCode,
        });

        if (isAlreadyMinted) {
            setError(`A product already exists for the domain ${domain}`);
        } else if (!isRecordSet) {
            setError(`The DNS txt record is not set for the domain ${domain}`);
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
                name="productTypes"
                rules={{
                    required: "Select a product type",
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            Select a product type
                        </FormLabel>
                        <MultiSelect
                            options={Object.keys(productTypesMask).map(
                                (key) => ({
                                    name: productTypesLabel[
                                        key as keyof typeof productTypesLabel
                                    ].name,
                                    value: key,
                                    tooltip:
                                        productTypesLabel[
                                            key as keyof typeof productTypesLabel
                                        ].description,
                                })
                            )}
                            onValueChange={(value) => {
                                const values = value
                                    .map((v) => v.value)
                                    .filter((v) => v !== undefined);
                                field.onChange(values);
                            }}
                            placeholder="Select a product type"
                            {...field}
                        />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="setupCode"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            Enter your setup code (optional)
                        </FormLabel>
                        <FormControl>
                            <Input
                                length={"medium"}
                                placeholder={"Setup code...."}
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

            {dnsRecord || isLoading ? (
                <>
                    <p>
                        DNS TXT record expected to set for domain validation is:{" "}
                    </p>
                    {isLoading ? <Spinner /> : <pre>{dnsRecord}</pre>}
                </>
            ) : null}

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
 * @param productTypes
 * @constructor
 */
function NewProductVerify({
    name,
    domain,
    setupCode,
    productTypes,
}: {
    name: string;
    domain: string;
    productTypes: ProductTypesKey[];
    setupCode: string;
}) {
    const setIsMinting = useSetAtom(isMintingAtom);
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

    const {
        mutate: triggerMintMyContent,
        isIdle,
        error,
        data: { mintTxHash } = {},
    } = useMintMyProduct();

    const { isLoading: isWaitingForFinalisedCreation, data: isConfirmed } =
        useQuery({
            queryKey: ["mint", "wait-for-finalised-deployment"],
            enabled: !!mintTxHash,
            queryFn: async () => {
                if (!mintTxHash) return false;

                // Invalidate the product related cache
                await waitForTxAndInvalidateQueries({
                    hash: mintTxHash,
                    queryKey: ["product"],
                });
                setIsMinting(false);
                return true;
            },
        });

    if (!domain) return null;

    return (
        <div>
            <p className={styles.newProductForm__introduction}>
                <strong>Verify your information</strong>
            </p>
            <p className={styles.newProductForm__verify}>
                I confirm that I want to list "{name}" on the following domain :
                <br />
                <strong>{domain}</strong>
                <br />
                Uri: <strong>{domain}</strong>
            </p>
            <AuthFingerprint
                className={styles.newProductForm__fingerprint}
                action={() => {
                    setIsMinting(true);
                    triggerMintMyContent({
                        name,
                        domain,
                        productTypes,
                        setupCode,
                    });
                }}
                disabled={!isIdle}
            >
                Validate you Product
            </AuthFingerprint>

            {error && <p className={"error"}>{error.message}</p>}
            <ProductSuccessInfo
                txHash={mintTxHash}
                isWaitingForFinalisedCreation={isWaitingForFinalisedCreation}
                isConfirmed={isConfirmed}
            />
        </div>
    );
}

/**
 * If created but waiting for finalised, show a spinner
 *  Once finalised and success, show txHash + success message
 */
function ProductSuccessInfo({
    txHash,
    isWaitingForFinalisedCreation,
    isConfirmed,
}: {
    txHash?: Hex;
    isWaitingForFinalisedCreation: boolean;
    isConfirmed?: boolean | null;
}) {
    if (!txHash) return null;

    if (txHash && isWaitingForFinalisedCreation && !isConfirmed) {
        return (
            <p>
                Setting all the right blockchain data
                <span className={"dotsLoading"}>...</span>
            </p>
        );
    }

    return (
        <>
            <p className={"success"}>
                Your product has been successfully listed on transaction
            </p>
            <br />
            {txHash && <p>Transaction hash: {txHash}</p>}
        </>
    );
}
