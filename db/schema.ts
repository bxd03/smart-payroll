import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const payrollState = sqliteTable("payroll_state", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(0),
});
export const sourceFiles = sqliteTable("source_files", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull(),
  rows: integer("rows").notNull().default(0),
});
export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  detail: text("detail").notNull(),
  createdAt: text("created_at").notNull(),
});
