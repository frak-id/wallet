"use client";

import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useMintMyProduct } from "@/module/dashboard/hooks/useMintMyProduct";
import type { Currency, ProductTypesKey } from "@frak-labs/core-sdk";
import { Button } from "@frak-labs/ui/component/Button";
import { Checkbox } from "@frak-labs/ui/component/forms/Checkbox";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { useState } from "react";
import styles from "./index.module.css";

export function MintProduct() {
    const [formData, setFormData] = useState({
        name: "",
        domain: "",
        currency: "usd" as Currency,
        productTypes: [] as ProductTypesKey[],
    });

    const {
        mutation: { mutate: triggerMint, isPending, error },
        infoTxt,
    } = useMintMyProduct({
        onSuccess: () => {
            // Reset form on success
            setFormData({
                name: "",
                domain: "",
                currency: "usd",
                productTypes: [],
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (
            !formData.name ||
            !formData.domain ||
            formData.productTypes.length === 0
        ) {
            return;
        }

        triggerMint({
            name: formData.name,
            domain: formData.domain,
            productTypes: formData.productTypes,
            setupCode: "", // For manual minting, we might not need setup code
            currency: formData.currency,
        });
    };

    const productTypeOptions = [
        { value: "dapp", label: "DApp" },
        { value: "press", label: "Press" },
        { value: "webshop", label: "Web Shop" },
        { value: "retail", label: "Retail" },
        { value: "referral", label: "Referral" },
        { value: "purchase", label: "Purchase" },
    ];

    const currencyOptions = [
        { value: "usd", label: "USD" },
        { value: "eur", label: "EUR" },
        { value: "gbp", label: "GBP" },
    ];

    return (
        <>
            <Title>Mint New Product</Title>
            <Panel title="Product Information">
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.field}>
                        <label htmlFor="name">Product Name</label>
                        <Input
                            id="name"
                            type="text"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    name: e.target.value,
                                })
                            }
                            placeholder="Enter product name"
                            required
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="domain">Domain</label>
                        <Input
                            id="domain"
                            type="text"
                            value={formData.domain}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    domain: e.target.value,
                                })
                            }
                            placeholder="example.com"
                            required
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="currency">Currency</label>
                        <select
                            id="currency"
                            value={formData.currency}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    currency: e.target.value as Currency,
                                })
                            }
                            className={styles.select}
                        >
                            {currencyOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.field}>
                        <p>Product Types</p>
                        <div className={styles.checkboxGroup}>
                            {productTypeOptions.map((option) => (
                                <label
                                    htmlFor={option.value}
                                    key={option.value}
                                    className={styles.checkbox}
                                >
                                    <Checkbox
                                        id={option.value}
                                        checked={formData.productTypes.includes(
                                            option.value as ProductTypesKey
                                        )}
                                        onCheckedChange={(checked: boolean) => {
                                            const productType =
                                                option.value as ProductTypesKey;
                                            if (checked) {
                                                setFormData({
                                                    ...formData,
                                                    productTypes: [
                                                        ...formData.productTypes,
                                                        productType,
                                                    ],
                                                });
                                            } else {
                                                setFormData({
                                                    ...formData,
                                                    productTypes:
                                                        formData.productTypes.filter(
                                                            (type) =>
                                                                type !==
                                                                productType
                                                        ),
                                                });
                                            }
                                        }}
                                    />
                                    {option.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        size="medium"
                        isLoading={isPending}
                        disabled={
                            isPending ||
                            !formData.name ||
                            !formData.domain ||
                            formData.productTypes.length === 0
                        }
                    >
                        {isPending ? infoTxt || "Minting..." : "Mint Product"}
                    </Button>

                    {error && <p className={styles.error}>{error.message}</p>}
                </form>
            </Panel>
        </>
    );
}
