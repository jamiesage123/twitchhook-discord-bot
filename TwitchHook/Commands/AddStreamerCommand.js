const _ = require('lodash');
const moment = require('moment');
const axios = require('axios');
const TwitchHookCommand = require('./TwitchHookCommand');

class AddStreamerCommand extends TwitchHookCommand {
    /**
     * Execute the command
     */
    execute(...params) {
        // Ensure the username was provided
        if (_.isEmpty(params) || (params && params.length !== 2)) {
            return this.channel.send("Please provide a Twitch username. For example: !twitchhook add [username] [platform (twitch|youtube)]");
        }

        // Get the username
        let usernames = [_.trim(params[0])];

        // Determine the platform
        let platform = _.trim(params[1]);

        // Ensure the platform is correct
        if (['youtube', 'twitch'].indexOf(platform) !== -1) {
            // Loop through each username
            usernames.forEach((username) => {
                // Ensure this user exists
                this.checkUsername(username, platform).then((res) => {
                    // Ensure the twitch user exists
                    if (res !== null) {
                        // Fetch the streamer by username
                        this.twitchHook.database.all("SELECT * FROM streamers WHERE server_id = ? AND username = ?", this.message.member.guild.id, username.toLowerCase()).then((streamers) => {
                            // Ensure they are not already added
                            if (streamers.length !== 0) {
                                return this.channel.send(username + " is already on your list!");
                            }

                            // Add the streamer
                            this.twitchHook.database.run("INSERT INTO streamers (server_id, username, platform, created_at) VALUES (?, ?, ?, ?)", this.message.member.guild.id, username.toLowerCase(), platform.toLowerCase(), moment().format('Y-m-d H:m:s'));

                            // Send a confirmation message
                            this.channel.send("Successfully added " + username + "!");
                        });
                    } else {
                        this.channel.send("Could not find " + platform + " streamer " + username);
                    }
                }).catch(() => {
                    this.channel.send("Could not find " + platform + " streamer " + username);
                });
            });
        } else {
            this.channel.send("Invalid platform " + platform + ". Must be: twitch or youtube");
        }
    }

    checkUsername(username, platform) {
        if (platform === "twitch") {
            return this.twitchHook.twitch.helix.users.getUserByName(username);
        } else if (platform === "youtube") {
            return axios.get(`https://www.youtube.com/${username}`);
        }

        return null;
    }
}

module.exports = AddStreamerCommand;