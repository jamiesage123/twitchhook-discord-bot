const moment = require('moment');
const TwitchClient = require('twitch').default;
const _ = require('lodash');

class LiveMessage {
    /**
     * LiveMessage constructor
     * @param database
     * @param bot
     * @param twitchClientId
     */
    constructor(database, bot, twitchClientId) {
        // The bot instance
        this.bot = bot;

        // The database instance
        this.database = database;

        // Twitch client instance
        this.twitch = TwitchClient.withClientCredentials(twitchClientId);
    }

    /**
     * Add/remove the live messages
     */
    async checkLiveMessages() {
        return new Promise((resolve, reject) => {
            // Get all the servers
            return this.database.getServers().then((servers) => {
                let promises = [];

                // Loop through all the servers
                servers.forEach((server) => {
                    // Create a promise with all the actions we're going to take
                    let promise = this.checkLiveMessagesForServer(server).then((liveStreamers) => {
                        // Add the multi stream link to the channel
                        this.createMultiStreamLink(server, liveStreamers);
                    });

                    // Add the promise to our array
                    promises.push(promise);
                });

                // Wait for all promises to be finished
                Promise.all(promises).finally(resolve).catch(reject);
            });
        });
    }

    /**
     * Add/remove the live messages for a specific server
     * @param server
     * @returns {Promise<unknown>}
     */
    async checkLiveMessagesForServer(server) {
        // We only want to run if this server has associated a twitch channel
        return new Promise((resolve, reject) => {
            if (!_.isEmpty(server.twitch_channel_id)) {
                // Get all the streamers for this server
                return this.database.getStreamers(server).then((streamers) => {
                    console.log("Checking streamers...", streamers.map((streamer) => streamer.username));
                    let liveStreamers = [];

                    // Get the Twitch status for all these streamers
                    return this.twitch.helix.streams.getStreams({userName: streamers.map((streamer) => streamer.username)}).then((response) => {
                        let promises = [];

                        // Loop through our streamers
                        streamers.forEach((streamer) => {
                            promises.push(async () => {
                                // Find the twitch data for this streamer
                                let data = response.data.find((item) => item._data.user_name.toLowerCase() === streamer.username.toLowerCase());

                                // Determine if this user is live
                                if (data !== undefined) {
                                    // Add the users to the live streamers list
                                    liveStreamers.push(data);

                                    // Add the live message
                                    await this.addLiveMessage(server, data);
                                } else {
                                    // Remove the live message
                                    await this.removeLiveMessage(server, streamer.username);
                                }
                            });
                        });

                        // Wait for all the promises to resolve
                        Promise.all(promises.map((fn) => fn())).finally(() => {
                            resolve(liveStreamers);
                        });
                    })
                });
            } else {
                // Server does not have a twitch channel, respond with an empty array
                resolve([]);
            }
        });
    }

    /**
     * Add the multi stream link to the twitch channel
     * @param server
     * @param streamers
     */
    async createMultiStreamLink(server, streamers) {
        let channel = await this.getTwitchChannel(server);

        let formattedMessage = "Watch all streams at https://multistre.am/" + streamers.map((item) => item._data.user_name).join('/');
        let skip    = false;

        // Delete the previous message
        channel.fetchMessages().then((messages) => {
            messages.forEach((message) => {
                if (message.content === formattedMessage) {
                    skip = true;
                }

                if (message.content.indexOf('https://multistre.am/') !== -1 && !skip) {
                    message.delete();
                }
            })

            // Add the new message
            if (!skip && streamers.length > 1) {
                setTimeout(() => {
                    // Remove the existing multi stream link
                    channel.send(formattedMessage);
                }, 3000);
            }
        });
    };

    /**
     * Get a servers twitch channel
     * @param server
     * @returns {Channel}
     */
    getTwitchChannel(server) {
        return this.bot.channels.get(server.twitch_channel_id);
    }

    /**
     * Add a live stream message to the channel
     * @param server
     * @param twitchStream
     */
    async addLiveMessage(server, twitchStream) {
        // Determine if this streamer already has a message
        let messages = await this.database.getLiveMessages(twitchStream._data.user_name);

        // Get the twitch channel
        let channel = this.getTwitchChannel(server);

        // Get the users information
        let user = await twitchStream.getUser();

        // Check that the messages still exist
        messages.forEach((message, index) => {
            channel.fetchMessage(message.message_id).catch(() => {
                // Message has been deleted
                this.removeLiveMessage(server, user.name);

                // Remove the message from the array
                delete messages[index];
            });
        });

        // Ensure that a message doesn't already exist
        if (messages.length === 0) {
            // Get the games information
            let game = await twitchStream.getGame();

            // Add the message
            let message = await channel.send({ embed: {
                    title: twitchStream.title,
                    url: `https://www.twitch.tv/${user.name}`,
                    author: {
                        name: `${user.displayName} is now live on Twitch!`,
                        url: `https://www.twitch.tv/${user.name}`,
                        icon_url: user.profilePictureUrl
                    },
                    description: `Playing ${game.name} with ${twitchStream.viewers} viewers`,
                    image: {
                        url: twitchStream.thumbnailUrl.replace('{width}', '1920').replace('{height}', '1080'),
                    },
                    timestamp: new Date(twitchStream.startDate)
                }
            });

            await this.database.run(`INSERT INTO twitch_messages (server_id, message_id, username, created_at) VALUES (?, ?, ?, ?)`, server.id, message.id, user.name.toLowerCase(), moment().format('Y-m-d H:m:s'));
        }
    }

    /**
     * Remove all live messages for a streamer
     * @param server
     * @param streamerUsername
     */
    async removeLiveMessage(server, streamerUsername) {
        // Determine if this streamer already has a message
        let messages = await this.database.getLiveMessages(streamerUsername);

        // Get the twitch channel
        let channel = this.getTwitchChannel(server);

        messages.forEach((message) => {
            // Attempt to find the message
            channel.fetchMessage(message.message_id).then((channelMessage) => {
                if (channelMessage) {
                    channelMessage.delete();
                }
            }).catch(() => null).finally(() => {
                // Remove it from the database
                this.database.removeLiveMessage(message);
            });
        });
    }
}

module.exports = LiveMessage;