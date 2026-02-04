const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    createdAt TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS vents (
    id TEXT PRIMARY KEY,
    roomId TEXT,
    text TEXT NOT NULL,
    anonymousHandle TEXT NOT NULL,
    deviceId TEXT NOT NULL,
    moodBefore INTEGER NOT NULL,
    moodAfter INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (roomId) REFERENCES rooms(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    ventId TEXT NOT NULL,
    text TEXT NOT NULL,
    anonymousHandle TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (ventId) REFERENCES vents(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reactions (
    id TEXT PRIMARY KEY,
    ventId TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('comment', 'support', 'empathy')),
    anonymousHandle TEXT NOT NULL,
    deviceId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (ventId) REFERENCES vents(id) ON DELETE CASCADE,
    UNIQUE(ventId, type, deviceId)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    ventId TEXT NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    deviceId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (ventId) REFERENCES vents(id) ON DELETE CASCADE
  )
`);

// Initialize default rooms
const defaultRooms = [
  { id: 'default-work', name: 'Work Frustrations', description: 'Share your workplace challenges' },
  { id: 'default-relationships', name: 'Relationships', description: 'Navigate relationship difficulties' },
  { id: 'default-anxiety', name: 'Anxiety & Worry', description: 'Express your anxieties' },
  { id: 'default-stress', name: 'Stress Relief', description: 'Let go of daily stress' },
  { id: 'default-family', name: 'Family Matters', description: 'Family-related concerns' },
  { id: 'default-loneliness', name: 'Loneliness', description: 'Feelings of isolation' },
  { id: 'default-grief', name: 'Grief & Loss', description: 'Processing loss and grief' },
  { id: 'default-anger', name: 'Anger', description: 'Managing anger and frustration' },
];

const insertRoom = db.prepare(`
  INSERT OR IGNORE INTO rooms (id, name, description, createdAt)
  VALUES (?, ?, ?, ?)
`);

const insertRooms = db.transaction((rooms) => {
  for (const room of rooms) {
    insertRoom.run(room.id, room.name, room.description || null, new Date().toISOString());
  }
});

insertRooms(defaultRooms);

console.log('Database initialized successfully!');
db.close();






