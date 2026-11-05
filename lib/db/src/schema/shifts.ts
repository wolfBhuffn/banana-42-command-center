import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  check,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const shiftsTable = pgTable(
  "shifts",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    hourlyRateCents: integer("hourly_rate_cents").notNull().default(2000),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("shifts_owner_started_at_idx").on(table.ownerId, table.startedAt),
    uniqueIndex("shifts_one_active_per_owner_idx")
      .on(table.ownerId)
      .where(sql`${table.endedAt} IS NULL`),
    check(
      "shifts_valid_time_range",
      sql`${table.endedAt} IS NULL OR ${table.endedAt} > ${table.startedAt}`,
    ),
    check(
      "shifts_nonnegative_hourly_rate",
      sql`${table.hourlyRateCents} >= 0`,
    ),
  ],
);

export const insertShiftSchema = createInsertSchema(shiftsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertShift = z.infer<typeof insertShiftSchema>;
export type ShiftRecord = typeof shiftsTable.$inferSelect;
