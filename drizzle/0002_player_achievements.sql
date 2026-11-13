CREATE TABLE IF NOT EXISTS player_achievements (identity TEXT NOT NULL, achievement_id TEXT NOT NULL, unlocked_at INTEGER NOT NULL, PRIMARY KEY(identity,achievement_id));
--> statement-breakpoint
ALTER TABLE players ADD COLUMN started INTEGER NOT NULL DEFAULT 1;
