const _ = require('lodash');
const moment = require('moment');
const TwitchHookCommand = require('./TwitchHookCommand');

class RemoveStreamerCommand extends TwitchHookCommand {
    /**
     * Execute the command
     */
    execute(username) {
        // Ensure the username was provided
        if (_.isEmpty(username)) {
            return this.channel.send("Please provide a Twitch username. For example: !remove DrDisrespect");
        }

        // Fetch the server
        this.twitchHook.database.all("SELECT * FROM servers WHERE server_id = ?", this.message.member.guild.id).then((servers) => {
            let server = servers[0];

            // Attempt to find the streamer
            this.twitchHook.database.all("SELECT * FROM streamers WHERE server_id = ? AND username = ?", this.message.member.guild.id, username.toLowerCase()).then((streamers) => {
                // Ensure they already exist
                if (streamers.length > 0) {
                    // Remove the streamer
                    this.twitchHook.database.run("DELETE FROM streamers WHERE server_id = ? AND username = ?", this.message.member.guild.id, username.toLowerCase());

                    // Remove any of the streamer messages
                    this.twitchHook.liveMessage.removeLiveMessage(server, username);

                    // Notify the channel
                    this.channel.send("Successfully removed " + username);
                } else {
                    // Notify the channel
                    this.channel.send("Streamer is not on your list!");
                }
            });
        });
    }
}

module.exports = RemoveStreamerCommand;