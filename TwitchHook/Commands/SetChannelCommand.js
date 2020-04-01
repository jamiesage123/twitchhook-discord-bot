const _ = require('lodash');

const TwitchHookCommand = require('./TwitchHookCommand');

class SetChannelCommand extends TwitchHookCommand {
    /**
     * Execute the command
     */
    execute() {
        // Fetch the server
        this.twitchHook.database.all("SELECT * FROM servers WHERE server_id = ?", this.message.member.guild.id).then((servers) => {
            let server = servers[0];

            // If the server currently has a twitch channel, remove any message
            if (!_.isEmpty(server.twitch_channel_id)) {
                this.twitchHook.database.all("SELECT * FROM twitch_messages WHERE server_id = ?", server.id).then((messages) => {
                    messages.forEach((message) => {
                        this.twitchHook.liveMessage.removeLiveMessage(server, message.username);
                    });
                });
            }

            // Set the new twitch channel
            this.twitchHook.database.run("UPDATE servers SET twitch_channel_id = ? WHERE server_id = ?", this.channel.id, this.message.member.guild.id);

            // Notify the channel
            this.channel.send("Successfully made this channel the twitch channel");
        });
    }
}

module.exports = SetChannelCommand;