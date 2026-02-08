import { integer, pgTable, text, timestamp, varchar, decimal, json, pgEnum } from "drizzle-orm/pg-core";

/**
 * PostgreSQL enums
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const strategyTypeEnum = pgEnum("strategy_type", [
  "long_call",
  "long_put",
  "short_call",
  "short_put",
  "bull_put_spread",
  "bear_call_spread"
]);
export const chartThemeEnum = pgEnum("chart_theme", ["light", "dark"]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Saved options strategies table
 * Stores user's saved options strategy configurations
 */
export const savedStrategies = pgTable("saved_strategies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull().references(() => users.id),
  strategyName: varchar("strategyName", { length: 100 }).notNull(),
  strategyType: strategyTypeEnum("strategyType").notNull(),
  underlyingTicker: varchar("underlyingTicker", { length: 20 }).notNull(),
  underlyingPrice: decimal("underlyingPrice", { precision: 10, scale: 2 }),
  // Store strategy configuration as JSON
  // For single leg: { contractTicker, strikePrice, premium, quantity, expirationDate }
  // For spreads: { longLeg: {...}, shortLeg: {...} }
  strategyConfig: json("strategyConfig").notNull(),
  // Calculated metrics
  maxProfit: decimal("maxProfit", { precision: 12, scale: 2 }),
  maxLoss: decimal("maxLoss", { precision: 12, scale: 2 }),
  breakEvenPrice: decimal("breakEvenPrice", { precision: 10, scale: 2 }),
  profitProbability: decimal("profitProbability", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SavedStrategy = typeof savedStrategies.$inferSelect;
export type InsertSavedStrategy = typeof savedStrategies.$inferInsert;

/**
 * Analysis history table
 * Tracks user's options analysis history for quick access
 */
export const analysisHistory = pgTable("analysis_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull().references(() => users.id),
  underlyingTicker: varchar("underlyingTicker", { length: 20 }).notNull(),
  strategyType: strategyTypeEnum("strategyType").notNull(),
  // Snapshot of analysis parameters and results
  analysisSnapshot: json("analysisSnapshot").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalysisHistory = typeof analysisHistory.$inferSelect;
export type InsertAnalysisHistory = typeof analysisHistory.$inferInsert;

/**
 * User preferences table
 * Stores user's application preferences and settings
 */
export const userPreferences = pgTable("user_preferences", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull().unique().references(() => users.id),
  // Default strategy type when opening the app
  defaultStrategy: strategyTypeEnum("defaultStrategy"),
  // Favorite tickers for quick access
  favoriteTickers: json("favoriteTickers").$type<string[]>(),
  // Display preferences
  chartTheme: chartThemeEnum("chartTheme").default("light"),
  showGreeks: integer("showGreeks").default(1), // boolean as integer
  showProbability: integer("showProbability").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;
