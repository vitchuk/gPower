import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config } from './config.js'

const require = createRequire(import.meta.url)
const sqliteVec = require('sqlite-vec')

mkdirSync(config.dataDir, { recursive: true })
export const DB_PATH = path.join(config.dataDir, 'gpower.db')
export const EMBEDDING_DIM = 1024

export const db = new DatabaseSync(DB_PATH, { allowExtension: true })
db.enableLoadExtension(true)
db.loadExtension(sqliteVec.getLoadablePath())

db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Новый чат',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    citations TEXT,
    tabata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tabatas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    params TEXT NOT NULL,
    exercises TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id TEXT NOT NULL,
    lang TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL
  );
`)

// Migration: existing databases predate the tabata snapshot column.
const messageColumns = db.prepare('PRAGMA table_info(messages)').all()
if (!messageColumns.some((c) => c.name === 'tabata')) {
  db.exec('ALTER TABLE messages ADD COLUMN tabata TEXT')
}

db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_docs USING vec0(
    doc_id INTEGER PRIMARY KEY,
    embedding float[${EMBEDDING_DIM}]
  );
`)
