import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  InsertUser, 
  users, 
  savedStrategies, 
  SavedStrategy, 
  InsertSavedStrategy,
  analysisHistory,
  AnalysisHistory,
  InsertAnalysisHistory,
  userPreferences,
  UserPreference,
  InsertUserPreference
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL);
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============= Saved Strategies =============

export async function createSavedStrategy(strategy: InsertSavedStrategy): Promise<SavedStrategy | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create strategy: database not available");
    return null;
  }

  const result = await db.insert(savedStrategies).values(strategy).returning({ id: savedStrategies.id });
  const insertedId = result[0].id;
  
  return getSavedStrategyById(insertedId);
}

export async function getSavedStrategyById(id: number): Promise<SavedStrategy | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(savedStrategies).where(eq(savedStrategies.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserSavedStrategies(userId: number): Promise<SavedStrategy[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(savedStrategies)
    .where(eq(savedStrategies.userId, userId))
    .orderBy(desc(savedStrategies.createdAt));
}

export async function deleteSavedStrategy(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(savedStrategies)
    .where(and(
      eq(savedStrategies.id, id),
      eq(savedStrategies.userId, userId)
    ))
    .returning({ id: savedStrategies.id });
  
  return result.length > 0;
}

// ============= Analysis History =============

export async function createAnalysisHistory(history: InsertAnalysisHistory): Promise<AnalysisHistory | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create analysis history: database not available");
    return null;
  }

  const result = await db.insert(analysisHistory).values(history).returning({ id: analysisHistory.id });
  const insertedId = result[0].id;
  
  const inserted = await db.select()
    .from(analysisHistory)
    .where(eq(analysisHistory.id, insertedId))
    .limit(1);
  
  return inserted.length > 0 ? inserted[0] : null;
}

export async function getUserAnalysisHistory(userId: number, limit: number = 50): Promise<AnalysisHistory[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(analysisHistory)
    .where(eq(analysisHistory.userId, userId))
    .orderBy(desc(analysisHistory.createdAt))
    .limit(limit);
}

// ============= User Preferences =============

export async function getUserPreferences(userId: number): Promise<UserPreference | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function upsertUserPreferences(prefs: InsertUserPreference): Promise<UserPreference | null> {
  const db = await getDb();
  if (!db) return null;

  await db.insert(userPreferences)
    .values(prefs)
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        defaultStrategy: prefs.defaultStrategy,
        favoriteTickers: prefs.favoriteTickers,
        chartTheme: prefs.chartTheme,
        showGreeks: prefs.showGreeks,
        showProbability: prefs.showProbability,
        updatedAt: new Date(),
      },
    });

  return getUserPreferences(prefs.userId);
}
