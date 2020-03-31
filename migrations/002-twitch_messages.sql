--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------

CREATE TABLE "twitch_messages" (
    "id"	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "message_id"	TEXT NOT NULL,
    "user_id"	TEXT NOT NULL,
    "created_at"	TEXT NOT NULL
);

--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------

DROP TABLE `twitch_messages`