const sqlite = require('sqlite');

class Database {
    /**
     * Database constructor
     * @param databaseFile
     */
    constructor(databaseFile) {
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
     * Run a query
     * @param query
     * @returns {Promise<Statement>}
     */
    run(query) {
        return this.db.run(query);
    }

    /**
     * Migrate the database
     * @returns {Promise<Database>}
     */
    migrate() {
        return this.db.migrate();
    }
}

module.exports = Database;