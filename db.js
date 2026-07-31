// Requires: npm install better-sqlite3
const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "fridge.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS latest_status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    relay TEXT,
    session_seconds INTEGER,
    off_seconds INTEGER,
    last_outage_seconds INTEGER,
    link TEXT,
    apn TEXT,
    received_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,             -- 'relay_change' | 'outage'
    event TEXT,            -- 'ON' | 'OFF' | null (for outage)
    duration_seconds INTEGER,
    timestamp INTEGER
  );

  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    relay TEXT,
    estimated_temp_c REAL,
    timestamp INTEGER
  );

  CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER DEFAULT 0,
    on_time TEXT DEFAULT '06:00',
    off_time TEXT DEFAULT '22:00',
    last_triggered_minute TEXT DEFAULT ''
  );

  INSERT OR IGNORE INTO schedule (id, enabled, on_time, off_time) VALUES (1, 0, '06:00', '22:00');
`);

function getLatestStatus() {
  return db.prepare("SELECT * FROM latest_status WHERE id = 1").get() || null;
}

function saveLatestStatus(status) {
  const receivedAt = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO latest_status (id, relay, session_seconds, off_seconds, last_outage_seconds, link, apn, received_at)
    VALUES (1, @relay, @session_seconds, @off_seconds, @last_outage_seconds, @link, @apn, @received_at)
    ON CONFLICT(id) DO UPDATE SET
      relay = excluded.relay,
      session_seconds = excluded.session_seconds,
      off_seconds = excluded.off_seconds,
      last_outage_seconds = excluded.last_outage_seconds,
      link = excluded.link,
      apn = excluded.apn,
      received_at = excluded.received_at
  `).run({ ...status, apn: status.apn || "", received_at: receivedAt });
}

function addEvent({ type, event, duration_seconds }) {
  db.prepare(`
    INSERT INTO events (type, event, duration_seconds, timestamp)
    VALUES (@type, @event, @duration_seconds, @timestamp)
  `).run({ type, event: event || null, duration_seconds, timestamp: Math.floor(Date.now() / 1000) });
}

function getHistory(limit = 50) {
  return db.prepare("SELECT * FROM events ORDER BY timestamp DESC LIMIT ?").all(limit);
}

function addReading(status) {
  db.prepare(`
    INSERT INTO readings (relay, estimated_temp_c, timestamp)
    VALUES (@relay, @estimated_temp_c, @timestamp)
  `).run({
    relay: status.relay,
    estimated_temp_c: status.estimated_temp_c ?? null,
    timestamp: Math.floor(Date.now() / 1000),
  });
  // keep the table bounded so it doesn't grow forever
  db.prepare(`
    DELETE FROM readings WHERE id NOT IN (
      SELECT id FROM readings ORDER BY timestamp DESC LIMIT 2000
    )
  `).run();
}

function getReadings(limit = 100) {
  const rows = db.prepare("SELECT * FROM readings ORDER BY timestamp DESC LIMIT ?").all(limit);
  return rows.reverse(); // oldest first, easier for charting
}

function getSchedule() {
  return db.prepare("SELECT * FROM schedule WHERE id = 1").get();
}

function updateSchedule({ enabled, on_time, off_time }) {
  const current = getSchedule();
  db.prepare(`
    UPDATE schedule SET
      enabled = @enabled,
      on_time = @on_time,
      off_time = @off_time
    WHERE id = 1
  `).run({
    enabled: enabled !== undefined ? (enabled ? 1 : 0) : current.enabled,
    on_time: on_time || current.on_time,
    off_time: off_time || current.off_time,
  });
  return getSchedule();
}

function markTriggered(minuteKey) {
  db.prepare("UPDATE schedule SET last_triggered_minute = ? WHERE id = 1").run(minuteKey);
}

module.exports = {
  getLatestStatus,
  saveLatestStatus,
  addEvent,
  getHistory,
  addReading,
  getReadings,
  getSchedule,
  updateSchedule,
  markTriggered,
};
