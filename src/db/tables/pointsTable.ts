import { InferColumnsDataTypes } from "drizzle-orm";
import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const pointsTable = pgTable("points", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InsertPoint = Omit<
  typeof pointsTable.$inferInsert,
  "id" | "createdAt"
>;
export type SelectPoint = typeof pointsTable.$inferSelect;
export type Point = InferColumnsDataTypes<typeof pointsTable._.columns>;

export const insertPointSchema = createInsertSchema(pointsTable);