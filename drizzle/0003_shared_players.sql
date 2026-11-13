-- A player with records in both channels needs an explicit human choice.
-- Evaluate before changing any persisted rows; a failed guard aborts the migration.
WITH identities AS (
 SELECT identity FROM players UNION SELECT identity FROM operations UNION SELECT identity FROM audit
 UNION SELECT identity FROM completed_runs UNION SELECT identity FROM last_run_backups UNION SELECT identity FROM player_achievements
)
SELECT CASE WHEN EXISTS (
 SELECT 1 FROM identities WHERE json_extract(identity,'$[0]') IN ('sandbox','production','shared')
 GROUP BY json_extract(identity,'$[1]'),json_extract(identity,'$[2]') HAVING COUNT(*)>1
) THEN json('Shared identity conflict: select the authoritative sandbox or production save before migration') ELSE 1 END;
--> statement-breakpoint
UPDATE players SET identity=json_array('shared',json_extract(identity,'$[1]'),json_extract(identity,'$[2]')),channel='shared' WHERE channel IN ('sandbox','production');
--> statement-breakpoint
UPDATE operations SET identity=json_array('shared',json_extract(identity,'$[1]'),json_extract(identity,'$[2]')) WHERE json_extract(identity,'$[0]') IN ('sandbox','production');
--> statement-breakpoint
UPDATE audit SET identity=json_array('shared',json_extract(identity,'$[1]'),json_extract(identity,'$[2]')) WHERE json_extract(identity,'$[0]') IN ('sandbox','production');
--> statement-breakpoint
UPDATE completed_runs SET identity=json_array('shared',json_extract(identity,'$[1]'),json_extract(identity,'$[2]')),channel='shared' WHERE channel IN ('sandbox','production');
--> statement-breakpoint
UPDATE last_run_backups SET identity=json_array('shared',json_extract(identity,'$[1]'),json_extract(identity,'$[2]')),channel='shared' WHERE channel IN ('sandbox','production');
--> statement-breakpoint
UPDATE player_achievements SET identity=json_array('shared',json_extract(identity,'$[1]'),json_extract(identity,'$[2]')) WHERE json_extract(identity,'$[0]') IN ('sandbox','production');
