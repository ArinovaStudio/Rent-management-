-- Backfill: in flats rented as one unit (Building flats, whole Apartment/Flat) only one person per flat is the main tenant.
-- The one paying the most rent wins (ties: earliest). Everyone else becomes a person sharing the flat.
UPDATE "Allocation" a
SET "isHousemate" = true
FROM "Room" r
JOIN "Property" p ON p."id" = r."propertyId"
WHERE a."roomId" = r."id"
  AND (p."type"::text = 'BUILDING' OR (p."type"::text <> 'PG' AND p."sharing" = false))
  AND a."status"::text = 'ACTIVE'
  AND EXISTS (
    SELECT 1 FROM "Allocation" b
    WHERE b."roomId" = a."roomId" AND b."status"::text = 'ACTIVE' AND b."id" <> a."id"
      AND (b."monthlyRent" > a."monthlyRent"
        OR (b."monthlyRent" = a."monthlyRent" AND (b."createdAt" < a."createdAt" OR (b."createdAt" = a."createdAt" AND b."id" < a."id"))))
  );
