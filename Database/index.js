const sqlite = require('sqlite');
const SqliteDefaults = require('./SqliteDefaults');

class Database extends SqliteDefaults {
    /**
     * Database constructor
     * @param databaseFile
     */
    constructor(databaseFile) {
        super();

        // Database file location
        this.databaseFile = databaseFile;

        // Database instance
        this.db = null;
    }

    /**
     * Initialise the database
     * @returns {Promise<void>}
     */
    async init() {
        this.db = await sqlite.open(this.databaseFile);
    }

    /**
     * Get all servers
     */
    getServers() {
        return this.all("SELECT * FROM servers");
    }

    /**
     * Get all streamers for a server
     * @param server
     */
    getStreamers(server, platform) {
        return this.all("SELECT * FROM streamers WHERE server_id = ? AND platform = ?", server.server_id, platform);
    }

    /**
     * Get a streamers live messages
     * @param username
     * @returns {*}
     */
    getLiveMessages(username) {
        return this.all("SELECT * FROM twitch_messages WHERE username = ?", username.toLowerCase());
    }

    /**
     * Remove a live message
     * @returns {Promise<Statement>}
     * @param twitchMessage
     */
    removeLiveMessage(twitchMessage) {
        return this.run("DELETE FROM twitch_messages WHERE id = ?", twitchMessage.id);
    }
}

module.exports = Database;