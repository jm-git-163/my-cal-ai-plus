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
    })
  }
  return dbPromise
}

export async function getAllMeals(): Promise<MealEntry[]> {
  const db = await getDb()
  const meals = await db.getAll('meals')
  return meals.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function addMeal(meal: MealEntry): Promise<void> {
  const db = await getDb()
  await db.put('meals', meal)
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
