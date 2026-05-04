-- Drop items that would conflict with the created index
DELETE FROM "product_oracle_purchase_item"
WHERE id NOT IN (
    SELECT MIN(id)
    FROM "product_oracle_purchase_item"
    GROUP BY "external_id", "purchase_id"
);

-- Create the index
CREATE UNIQUE INDEX IF NOT EXISTS "unique_external_purchase_item_id" ON "product_oracle_purchase_item" USING btree ("external_id","purchase_id");