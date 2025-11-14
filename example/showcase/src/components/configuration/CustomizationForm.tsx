import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/ui/component/Accordion";
import { ActivationCustomization } from "./ActivationCustomization";
import { CssCustomization } from "./CssCustomization";
import styles from "./CustomizationForm.module.css";
import { DismissCustomization } from "./DismissCustomization";
import { FinalCustomization } from "./FinalCustomization";
import { LoginCustomization } from "./LoginCustomization";

export function CustomizationForm() {
    return (
        <div className={styles.container}>
            <Accordion type="multiple">
                <AccordionItem value="css">
                    <AccordionTrigger>Customization of CSS</AccordionTrigger>
                    <AccordionContent>
                        <CssCustomization />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="login-en">
                    <AccordionTrigger>
                        Customization of login screen in English
                    </AccordionTrigger>
                    <AccordionContent>
                        <LoginCustomization lang="en" />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="login-fr">
                    <AccordionTrigger>
                        Customization of login screen in French
                    </AccordionTrigger>
                    <AccordionContent>
                        <LoginCustomization lang="fr" />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="activation-en">
                    <AccordionTrigger>
                        Customization of activation screen in English
                    </AccordionTrigger>
                    <AccordionContent>
                        <ActivationCustomization lang="en" />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="activation-fr">
                    <AccordionTrigger>
                        Customization of activation screen in French
                    </AccordionTrigger>
                    <AccordionContent>
                        <ActivationCustomization lang="fr" />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="dismiss-en">
                    <AccordionTrigger>
                        Customization of dismiss screen in English
                    </AccordionTrigger>
                    <AccordionContent>
                        <DismissCustomization lang="en" />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="dismiss-fr">
                    <AccordionTrigger>
                        Customization of dismiss screen in French
                    </AccordionTrigger>
                    <AccordionContent>
                        <DismissCustomization lang="fr" />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="final-en">
                    <AccordionTrigger>
                        Customization of final screen in English
                    </AccordionTrigger>
                    <AccordionContent>
                        <FinalCustomization lang="en" />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="final-fr">
                    <AccordionTrigger>
                        Customization of final screen in French
                    </AccordionTrigger>
                    <AccordionContent>
                        <FinalCustomization lang="fr" />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
