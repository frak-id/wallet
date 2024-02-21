import React, { memo } from "react";

export const ArticleContent = memo(function ArticleContent({
    data,
}: { data?: string }) {
    if (!data) return null;
    // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
    return <div dangerouslySetInnerHTML={{ __html: data }} />;
});
