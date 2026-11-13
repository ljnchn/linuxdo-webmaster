CREATE TABLE players (identity TEXT PRIMARY KEY NOT NULL, channel TEXT NOT NULL, public_id TEXT NOT NULL UNIQUE, run_id TEXT NOT NULL UNIQUE, state TEXT NOT NULL, revision INTEGER NOT NULL, name TEXT NOT NULL, members INTEGER NOT NULL, days INTEGER NOT NULL, speed INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 0, credit_ms INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL DEFAULT 0, commit_token TEXT NOT NULL DEFAULT '');
--> statement-breakpoint
CREATE TABLE operations (identity TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(identity,key));
--> statement-breakpoint
CREATE TABLE audit (id INTEGER PRIMARY KEY, identity TEXT NOT NULL, revision INTEGER NOT NULL, action TEXT NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE completed_runs (run_id TEXT PRIMARY KEY NOT NULL, identity TEXT NOT NULL, channel TEXT NOT NULL, public_id TEXT NOT NULL, name TEXT NOT NULL, members INTEGER NOT NULL, days INTEGER NOT NULL, state TEXT NOT NULL, finished_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX players_channel ON players(channel);
--> statement-breakpoint
CREATE INDEX completed_channel ON completed_runs(channel);
