const _ = require('lodash');
const moment = require('moment');
const TwitchHookCommand = require('./TwitchHookCommand');

class AddStreamerCommand extends TwitchHookCommand {
    /**
     * Execute the command
     */
    execute(...params) {
        // Ensure the username was provided
        if (_.isEmpty(params)) {
            return this.channel.send("Please provide a Twitch username. For example: !add DrDisrespect");
        }

        // Split the string by the "," separator to handle multiple usernames and trim any whitespaces
        let usernames = params.map((username) => _.trim(username)).filter((username) => username.length > 0);

        // Loop through each username
        usernames.forEach((username) => {
            // Ensure this user exists
            this.twitchHook.twitch.helix.users.getUserByName(username).then((res) => {
                // Ensure the twitch user exists
                if (res !== null) {
                    // Fetch the streamer by username
                    this.twitchHook.database.all("SELECT * FROM streamers WHERE server_id = ? AND username = ?", this.message.member.guild.id, username.toLowerCase()).then((streamers) => {
                        // Ensure they are not already added
                        if (streamers.length !== 0) {
                            return this.channel.send(username + " is already on your list!");
                        }

                        // Add the streamer
                        this.twitchHook.database.run("INSERT INTO streamers (server_id, username, created_at) VALUES (?, ?, ?)", this.message.member.guild.id, username.toLowerCase(), moment().format('Y-m-d H:m:s'));

                        // Send a confirmation message
                        this.channel.send("Successfully added " + username + "!");
                    });
                } else {
                    this.channel.send("Could not find twitch streamer " + username);
                }
            }).catch(() => {
                this.channel.send("Could not find twitch streamer " + username);
            });
        });
    }
}

module.exports = AddStreamerCommand;