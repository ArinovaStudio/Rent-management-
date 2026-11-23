-- Tenant history filters by the floor saved on each allocation, so fill it in for older rows that only had it on the room
UPDATE "Allocation" a SET "floorNumber" = r."floor" FROM "Room" r WHERE r."id" = a."roomId" AND a."floorNumber" IS NULL AND r."floor" IS NOT NULL;
