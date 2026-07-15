import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { MealEntry, UserSettings } from '@/types'
import { DEFAULT_SETTINGS, normalizeSettings } from '@/types'

interface CalAiDB extends DBSchema {
  meals: {
    key: string
    value: MealEntry
    indexes: { 'by-date': string }
  }
  settings: {
    key: string
    value: UserSettings
  }
}

const DB_NAME = 'my-cal-ai-plus'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<CalAiDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<CalAiDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const meals = db.createObjectStore('meals', { keyPath: 'id' })
        meals.createIndex('by-date', 'createdAt')
        db.createObjectStore('settings')
      },
    }).catch((err) => {
      dbPromise = null
      throw err
    })
  }
  return dbPromise
}

function isQuotaError(err: unknown) {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

export async function getAllMeals(): Promise<MealEntry[]> {
  const db = await getDb()
  const meals = await db.getAll('meals')
  return meals.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

/** Persist meal; on QuotaExceeded retry once without the photo. */
export async function addMeal(meal: MealEntry): Promise<MealEntry> {
  const db = await getDb()
  try {
    await db.put('meals', meal)
    return meal
  } catch (err) {
    if (isQuotaError(err) && meal.imageDataUrl) {
      const slim = { ...meal, imageDataUrl: undefined }
      await db.put('meals', slim)
      return slim
    }
    throw err
  }
}

export async function updateMeal(
  id: string,
  patch: Partial<Omit<MealEntry, 'id'>>,
): Promise<MealEntry | null> {
  const db = await getDb()
  const existing = await db.get('meals', id)
  if (!existing) return null
  const next = { ...existing, ...patch, id }
  await db.put('meals', next)
  return next
}

export async function deleteMeal(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('meals', id)
}

export async function getSettings(): Promise<UserSettings> {
  const db = await getDb()
  const settings = await db.get('settings', 'user')
  return normalizeSettings(settings ?? DEFAULT_SETTINGS)
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const db = await getDb()
  await db.put('settings', normalizeSettings(settings), 'user')
}
