# Staff email uniqueness production remediation

`StaffEmailUniquePerBusiness1784030000000` enforces one non-null, normalized
email per business. It does not delete, merge, deactivate, or otherwise choose
between duplicate staff records automatically.

Before applying the migration in production, identify collisions using the same
normalization as the application and migration:

```sql
SELECT
  "businessId",
  lower(btrim("email")) AS normalized_email,
  array_agg("id" ORDER BY "createdAt") AS staff_ids,
  count(*) AS staff_count
FROM "staff"
WHERE "email" IS NOT NULL
GROUP BY "businessId", lower(btrim("email"))
HAVING count(*) > 1
ORDER BY "businessId", normalized_email;
```

Review each group with the business owner and retain the account that should
keep the email. If an extra account has no replacement email, explicitly clear
only that account's email (replace the placeholder UUID with a reviewed staff
ID):

```sql
BEGIN;

UPDATE "staff"
SET "email" = NULL
WHERE "id" = '<duplicate-staff-id>'
  AND "businessId" = '<business-id>';

COMMIT;
```

Alternatively, assign a distinct, verified replacement email. Do not rely on
setting `isActive` or `deletedAt`: the required unique index includes all rows
with a non-null email. Re-run the diagnostic query until it returns no rows,
then run the migration. The migration normalizes remaining email values with
`lower(btrim(email))` and creates the unique index atomically.
