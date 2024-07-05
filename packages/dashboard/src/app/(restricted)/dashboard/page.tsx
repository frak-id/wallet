"use client";

import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { ButtonProduct } from "@/module/dashboard/component/ButtonProduct";
import { MyContents } from "@/module/dashboard/component/Contents";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import { Button } from "@module/component/Button";
import { BadgeCheck } from "lucide-react";
import { useForm } from "react-hook-form";

type ProductNew = {
    name: string;
    domain: string;
};

export default function DashboardPage() {
    const form = useForm<ProductNew>({
        defaultValues: {
            name: "",
            domain: "",
        },
    });

    function onSubmit(values: ProductNew) {
        console.log(values);
    }

    return (
        <>
            <Head
                title={{ content: "Dashboard" }}
                leftSection={<Breadcrumb current={"Home"} />}
            />

            <Panel variant={"ghost"} title={"My Products"}>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <AlertDialog
                            title={
                                <>
                                    <BadgeCheck color={"#0DDB84"} /> List a New
                                    Product
                                </>
                            }
                            description={
                                "To list a new product, you must enter the domain name of the website where the SDK has been installed."
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
                                                        placeholder={
                                                            "Product Name...."
                                                        }
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
                                            required: "Invalid domain name",
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
                                                            placeholder={
                                                                "Domain Name...."
                                                            }
                                                            {...field}
                                                        />
                                                        <Button
                                                            variant={"submit"}
                                                        >
                                                            Verify
                                                        </Button>
                                                    </Row>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </>
                            }
                            cancel={<Button variant={"outline"}>Cancel</Button>}
                            action={
                                <Button type={"submit"} variant={"information"}>
                                    Next
                                </Button>
                            }
                        />
                    </form>
                </Form>
            </Panel>

            <MyContents />
        </>
    );
}
