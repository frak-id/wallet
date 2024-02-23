import { AdminGate } from "@/module/admin/component/AdminGate";
import { ArticleCreation } from "@/module/admin/component/ArticleCreation";
import { ArticlesList } from "@/module/article/component/ArticlesList";

export default function AdminPage() {
    return (
        <div>
            <AdminGate>
                <h1>Admin Page</h1>
                <h2>List of all the articles</h2>
                <ArticlesList />
                <h2>Create a new article</h2>
                <ArticleCreation />
            </AdminGate>
        </div>
    );
}
