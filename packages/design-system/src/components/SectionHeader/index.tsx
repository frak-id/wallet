import { Box } from "../Box";
import { sectionHeaderStyles } from "./sectionHeader.css";

type SectionHeaderProps = {
    title: string;
};

export function SectionHeader({ title }: SectionHeaderProps) {
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
        </Box>
    );
}
