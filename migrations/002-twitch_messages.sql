--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------

CREATE TABLE "twitch_messages" (
    "id"	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "server_id"	 TEXT NOT NULL,
    "message_id"	TEXT NOT NULL,
    "username"	TEXT NOT NULL,
    "created_at"	TEXT NOT NULL
);

--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------

DROP TABLE `twitch_messages`