import { Box } from "@/components/Box";
import { sectionHeaderStyles } from "./sectionHeader.css";

type SectionHeaderAction = {
    label: string;
    onClick: () => void;
};

type SectionHeaderProps = {
    title: string;
    action?: SectionHeaderAction;
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
    return (
        <Box
            className={sectionHeaderStyles.container}
            display="flex"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
        >
            <Box as="span" className={sectionHeaderStyles.title}>
                {title}
            </Box>
            {action && (
                <Box
                    as="button"
                    type="button"
                    className={sectionHeaderStyles.action}
                    onClick={action.onClick}
                >
                    {action.label}
                </Box>
            )}
        </Box>
    );
}
