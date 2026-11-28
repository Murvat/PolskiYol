CREATE TABLE live_rooms (
  lesson_id TEXT PRIMARY KEY REFERENCES lessons(id),
  provider TEXT NOT NULL,
  room_key TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('starting', 'live', 'ending', 'ended')),
  session_id TEXT,
  closes_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_live_rooms_closes ON live_rooms(state, closes_at);
--> statement-breakpoint
CREATE TABLE live_room_cleanup (
  room_key TEXT NOT NULL REFERENCES live_rooms(room_key),
  session_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  retry_at TEXT NOT NULL,
  PRIMARY KEY (room_key, session_id)
);
--> statement-breakpoint
CREATE INDEX idx_live_room_cleanup_retry ON live_room_cleanup(retry_at);
