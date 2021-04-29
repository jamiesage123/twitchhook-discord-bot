--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------

alter table streamers add platform TEXT default twitch;

--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------

create table streamers_dg_tmp
(
    id INTEGER not null
        primary key autoincrement,
    server_id TEXT,
    username TEXT not null,
    created_at TEXT not null
);

insert into streamers_dg_tmp(id, server_id, username, created_at) select id, server_id, username, created_at from streamers;

drop table streamers;

alter table streamers_dg_tmp rename to streamers;