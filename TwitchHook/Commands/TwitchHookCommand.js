class TwitchHookCommand {
    /**
     * TwitchHookCommand constructor
     * @param twitchHook
     * @param message
     */
    constructor(twitchHook, message) {
        // The twitch hook class instance
        this.twitchHook = twitchHook;

        // The message channel
        this.message = message;

        // The discord channel
        this.channel = this.message.channel;
    }
}

module.exports = TwitchHookCommand;