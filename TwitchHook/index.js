require('dotenv').config();
const moment = require('moment');
const Discord = require('discord.js');
const TwitchClient = require('twitch').default;
const _ = require('lodash');

const Database = require('../Database');

class TwitchHook {
    constructor() {
        // Fetch the bot token from the environment
        this.botToken = process.env.BOT_TOKEN;

        // Fetch the twitch client id from the environment
        this.twitchClientId = process.env.TWITCH_CLIENT_ID;

        // Create the bot
        this.bot =  new Discord.Client();

        // Twitch client instance
        this.twitch = TwitchClient.withClientCredentials(this.twitchClientId);

        // Database instance
        this.database = new Database('./database.sqlite');
    }

    /**
     * Initialise the bot
     */
    async init() {
        // Ensure we have a bot token
        if (_.isEmpty(this.botToken)) {
            console.error("Please provide a BOT_TOKEN inside the .env file");
        }

        // Ensure we have a twitch client id
        if (_.isEmpty(this.twitchClientId)) {
            console.error("Please provide a TWITCH_CLIENT_ID inside the .env file");
        }

        // Initialise the database
        await this.database.init();

        // Migrate the database
        await this.database.migrate();

        // Connect the bot
        await this.connect();

        // Start the bot
        this.start();
    }

    /**
     * Connect the bot
     */
    async connect() {
        // Log the bot in
        await this.bot.login(this.botToken);

        // Create an event for when the bot is ready
        this.bot.on('ready', () => {
            console.info(`Logged in as ${this.bot.user.tag}!`);
        });

        // Add an event when this bot joins a new server
        this.bot.on("guildCreate", (guild) => {
            console.log("Joined new guild: " + guild.name);
            this.database.run(`INSERT INTO servers (server_id, created_at) VALUES ('${guild.id}', '${moment().format('Y-m-d H:m:s')}')`);
        });

        // Add an event when this bot is removed from a server
        this.bot.on("guildDelete", (guild) => {
            console.log("Left guild: " + guild.name);
            this.database.run(`DELETE FROM servers WHERE server_id = '${guild.id}'`);
        });
    }

    /**
     * Start the bot
     */
    start() {
        // Run immediately
        this.checkLiveMessages().catch(console.error);

        // Star the timeout
        setInterval(() => {
            this.checkLiveMessages().catch(console.error);
        }, 15000);
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
                    let liveStreamers = [];

                    // Create a promise with all the actions we're going to take
                    let promise = () => {
                        // We only want to run if this server has associated a twitch channel
                        return new Promise((resolve, reject) => {
                            if (!_.isEmpty(server.twitch_channel_id)) {
                                // Get all the streamers for this server
                                return this.database.getStreamers(server).then((streamers) => {
                                    console.log("Checking streamers...", streamers.map((streamer) => streamer.username));
                                    // Get the Twitch status for all these streamers
                                    return this.twitch.helix.streams.getStreams({userName: streamers.map((streamer) => streamer.username)}).then((response) => {
                                        let promises = [];

                                        // Loop through our streamers
                                        streamers.forEach((streamer) => {
                                            promises.push(() => {
                                                // Find the twitch data for this streamer
                                                let data = response.data.find((item) => item._data.user_name.toLowerCase() === streamer.username.toLowerCase());

                                                // Determine if this user is live
                                                let isLive = data !== undefined;

                                                if (isLive) {
                                                    liveStreamers.push(data);
                                                    return this.addLiveMessage(server, data);
                                                } else {
                                                    return this.removeLiveMessage(server, streamer.username);
                                                }
                                            });
                                        });

                                        Promise.all(promises.map((fn) => fn())).finally(resolve);
                                    })
                                });
                            } else {
                                resolve();
                            }
                        });
                    };

                    // Run the promise
                    promise = promise();

                    // Add the promise to our array
                    promises.push(promise);

                    // Add the multi stream link to the channel
                    promise.finally(() => {
                        this.createMultiStreamLink(server, liveStreamers);
                    });
                });

                // Wait for all promises to be finished
                Promise.all(promises).finally(resolve).catch(reject);
            });
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

            await this.database.run(`INSERT INTO twitch_messages (message_id, username, created_at) VALUES (?, ?, ?)`, message.id, user.name.toLowerCase(), moment().format('Y-m-d H:m:s'));
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

module.exports = TwitchHook;