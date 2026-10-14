CREATE TABLE lessons (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  discipline TEXT NOT NULL CHECK (discipline IN ('Boxing', 'Wrestling', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'MMA', 'Personal Training')),
  skill_level TEXT NOT NULL DEFAULT 'Beginner' CHECK (skill_level IN ('Beginner', 'Intermediate', 'Advanced')),
  duration_minutes INTEGER CHECK (duration_minutes > 0),
  goal TEXT NOT NULL DEFAULT '',
  drills TEXT NOT NULL DEFAULT '',
  coaching_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
