const moment = require('moment');
const _ = require('lodash');
const axios = require('axios');
const cheerio = require('cheerio');

class LiveMessage {
    /**
     * LiveMessage constructor
     * @param database
     * @param bot
     * @param twitch
     */
    constructor(database, bot, twitch) {
        // The bot instance
        this.bot = bot;

        // The database instance
        this.database = database;

        // Twitch client instance
        this.twitch = twitch;
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
        let streamers = new Promise.all([
            this.checkLiveMessagesForTwitch(server),
            this.checkLiveMessagesForYoutube(server)
        ]);

        return streamers;
    }

    /**
     * Check and create live messages for live twitch streamers on a specific server
     * @param server
     * @returns {Promise<unknown>}
     */
    async checkLiveMessagesForTwitch(server) {
        // We only want to run if this server has associated a twitch channel
        return new Promise((resolve, reject) => {
            if (!_.isEmpty(server.twitch_channel_id)) {
                // Get all the streamers for this server
                return this.database.getStreamers(server, 'twitch').then((streamers) => {
                    if (streamers.length > 0) {
                        console.log("[TWITCH HOOK] Starting checks on " + server.server_id + " for twitch streamers: " + streamers.map((streamer) => `${streamer.username}`).join(', '));
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
                                        await this.addTwitchLiveMessage(server, data);
                                    } else {
                                        // Remove the live message
                                        await this.removeLiveMessage(server, streamer.username, 'twitch');
                                    }
                                });
                            });

                            // Wait for all the promises to resolve
                            Promise.all(promises.map((fn) => fn())).finally(() => {
                                resolve(liveStreamers);
                            });
                        }).catch((e) => {
                            console.log("[TWITCH HOOK] Twitch API error: ", e);
                        });
                    }
                });
            } else {
                // Server does not have a twitch channel, respond with an empty array
                resolve([]);
            }
        });
    }

    /**
     * Check and create live messages for live youtube streamers on a specific server
     * @param server
     * @returns {Promise<unknown>}
     */
    async checkLiveMessagesForYoutube(server) {
        // We only want to run if this server has associated a twitch channel
        return new Promise((resolve, reject) => {
            if (!_.isEmpty(server.twitch_channel_id)) {
                // Get all the streamers for this server
                return this.database.getStreamers(server, 'youtube').then((streamers) => {
                    if (streamers.length > 0) {
                        console.log("[TWITCH HOOK] Starting checks on " + server.server_id + " for youtube streamers: " + streamers.map((streamer) => `${streamer.username}`).join(', '));
                        let liveStreamers = [];
                        let promises = [];

                        streamers.forEach((streamer) => {
                            promises.push(
                                new Promise((resolve, reject) => {
                                    axios.get(`https://www.youtube.com/${streamer.username}`).then((res) => {
                                        let page = res.data;
                                        let parts = page.split(' watching');

                                        let parser = cheerio.load(res.data);

                                        // Check if the channel is live
                                        if (parts.length > 2) {
                                            // Add the users to the live streamers list
                                            liveStreamers.push(streamer);

                                            let title = parser('title').text();
                                            let data = {
                                                ...streamer,
                                                title: title && title.length ? title.replace(' - YouTube', '') : '',
                                                thumbnail: parser('meta[property="og:image"]').attr('content')
                                            }

                                            // Add the live message
                                            this.addYoutubeLiveMessage(server, data).then(() => {
                                                resolve();
                                            }).catch((err) => {
                                                console.error(err);
                                                reject(err);
                                            });
                                        } else {
                                            // Remove the live message
                                            this.removeLiveMessage(server, streamer.username, 'youtube').then(resolve)
                                                .catch((err) => {
                                                    console.error(err);
                                                    reject(err);
                                                });
                                        }
                                    }).catch((err) => {
                                        console.warn(`Error when searching for ${streamer.username} (youtube)`);
                                    });
                                })
                            );
                        });

                        return Promise.all(promises);
                    }
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
        // Proceed only if the server has a twitch channel
        if (server.twitch_channel_id) {
            let channel = await this.getTwitchChannel(server);
            let formattedMessage = "Watch all streams at https://multistre.am/" + streamers.map((item) => item._data.user_name).join('/');
            let skip = false;

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
        }
    };

    /**
     * Get a servers twitch channel
     * @param server
     * @returns {Channel|null}
     */
    getTwitchChannel(server) {
        let channel = this.bot.channels.get(server.twitch_channel_id);

        // If this channel does not exist, remove it from the database
        if (typeof channel === "undefined" || channel === null) {
            this.database.run(`UPDATE servers SET twitch_channel_id = null WHERE id = ?`, server.id);
        }

        return channel;
    }

    /**
     * Add a live stream message to the channel (youtube)
     * @param server
     * @param twitchStream
     */
    async addYoutubeLiveMessage(server, youtubeStreamer) {
        // Determine if this streamer already has a message
        let messages = await this.database.getLiveMessages(`${youtubeStreamer.username} youtube`);

        // Get the twitch channel
        let channel = this.getTwitchChannel(server);

        // Check that the messages still exist
        messages.forEach((message, index) => {
            channel.fetchMessage(message.message_id).catch(() => {
                // Message has been deleted
                this.removeLiveMessage(server, youtubeStreamer.username, 'youtube');

                // Remove the message from the array
                delete messages[index];
            });
        });


        // Ensure that a message doesn't already exist
        if (messages.length === 0) {
            // Add the message
            let message = await channel.send({ embed: {
                    title: `${youtubeStreamer.title} is live`,
                    url: `https://www.youtube.com/${youtubeStreamer.username}`,
                    author: {
                        name: `${youtubeStreamer.title} is now live on Youtube!`,
                        url: `https://www.youtube.com/${youtubeStreamer.username}`,
                        // icon_url: user.profilePictureUrl
                    },
                    // description: `Playing ${game.name} with ${twitchStream.viewers} viewers`,
                    image: {
                        url: youtubeStreamer.thumbnail,
                    },
                    // timestamp: new Date(twitchStream.startDate)
                }
            });

            await this.database.run(`INSERT INTO twitch_messages (server_id, message_id, username, created_at) VALUES (?, ?, ?, ?)`, server.id, message.id, `${youtubeStreamer.username.toLowerCase()} youtube`, moment().format('Y-m-d H:m:s'));
        }
    }

    /**
     * Add a live stream message to the channel (twitch)
     * @param server
     * @param twitchStream
     */
    async addTwitchLiveMessage(server, twitchStream) {
        // Determine if this streamer already has a message
        let messages = await this.database.getLiveMessages(`${twitchStream._data.user_name} twitch`);

        // Get the twitch channel
        let channel = this.getTwitchChannel(server);

        // Get the users information
        let user = await twitchStream.getUser();

        // Check that the messages still exist
        messages.forEach((message, index) => {
            channel.fetchMessage(message.message_id).catch(() => {
                // Message has been deleted
                this.removeLiveMessage(server, user.name, 'twitch');

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
                    title: `${user.displayName} is live - ${twitchStream.title}`,
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

            await this.database.run(`INSERT INTO twitch_messages (server_id, message_id, username, created_at) VALUES (?, ?, ?, ?)`, server.id, message.id, `${user.name.toLowerCase()} twitch`, moment().format('Y-m-d H:m:s'));
        }
    }

    /**
     * Remove all live messages for a streamer
     * @param server
     * @param streamerUsername
     */
    async removeLiveMessage(server, streamerUsername, platform) {
        // Determine if this streamer already has a message
        let messages = await this.database.getLiveMessages(`${streamerUsername}${typeof platform !== "undefined" ? ` ${platform}` : ''}`);

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