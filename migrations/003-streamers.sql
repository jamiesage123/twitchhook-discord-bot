--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------

CREATE TABLE "streamers" (
     "id"	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
     "user_id"	TEXT NOT NULL,
     "created_at"	TEXT NOT NULL
);

--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------

DROP TABLE `streamers`