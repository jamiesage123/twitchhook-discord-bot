const TwitchHookCommand = require('./TwitchHookCommand');

class ListStreamersCommand extends TwitchHookCommand {
    /**
     * Execute the command
     */
    execute() {
        // Fetch the streamers for this server
        this.twitchHook.database.all("SELECT * FROM streamers WHERE server_id = ?", this.message.member.guild.id).then((streamers) => {
            if (streamers.length > 0) {
                this.channel.send("Here is a list of your current streamers: " + streamers.map((streamer) => streamer.username).join(', '));
            } else {
                this.channel.send("You don't have any streamers set up. Use the !add command to add a new one");
            }
        });
    }
}

module.exports = ListStreamersCommand;