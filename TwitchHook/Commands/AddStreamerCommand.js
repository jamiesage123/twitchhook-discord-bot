const _ = require('lodash');
const moment = require('moment');
const TwitchHookCommand = require('./TwitchHookCommand');

class AddStreamerCommand extends TwitchHookCommand {
    /**
     * Execute the command
     */
    execute(username) {
        // Ensure the username was provided
        if (_.isEmpty(username)) {
            return this.channel.send("Please provide a Twitch username. For example: !add DrDisrespect");
        }

        // Fetch the streamer by username
        this.twitchHook.database.all("SELECT * FROM streamers WHERE server_id = ? AND username = ?", this.message.member.guild.id, username.toLowerCase()).then((streamers) => {
            // Ensure they are not already added
            if (streamers.length !== 0) {
                return this.channel.send("Streamer is already on your list!");
            }

            // Add the streamer
            this.twitchHook.database.run("INSERT INTO streamers (server_id, username, created_at) VALUES (?, ?, ?)", this.message.member.guild.id, username.toLowerCase(), moment().format('Y-m-d H:m:s'));

            // Send a confirmation message
            this.channel.send("Successfully added " + username + "!");
        });
    }
}

module.exports = AddStreamerCommand;