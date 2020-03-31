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
    getStreamers(server) {
        return this.all("SELECT * FROM streamers WHERE server_id = ?", server.server_id);
    }
}

module.exports = Database;