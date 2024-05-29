import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Button } from "@/module/common/component/Button";
import { Title } from "@/module/common/component/Title";
import { Plus } from "lucide-react";
import styles from "./index.module.css";

export function Head() {
    return (
        <div className={styles.head}>
            <div className={styles.head__left}>
                <Title>Campaigns</Title>
                <Breadcrumb />
            </div>
            <div>
                <Button leftIcon={<Plus size={20} />}>Create Campaign</Button>
            </div>
        </div>
    );
}
