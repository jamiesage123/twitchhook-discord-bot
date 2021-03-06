require('dotenv').config();
const moment = require('moment');
const Discord = require('discord.js');
const _ = require('lodash');
const TwitchClient = require('twitch').default;

const Database = require('../Database');
const LiveMessage = require('./LiveMessage');

const ListStreamersCommand = require('./Commands/ListStreamersCommand');
const AddStreamerCommand = require('./Commands/AddStreamerCommand');
const RemoveStreamerCommand = require('./Commands/RemoveStreamerCommand');
const SetChannelCommand = require('./Commands/SetChannelCommand');

class TwitchHook {
    commands = {
        list: ListStreamersCommand,
        add: AddStreamerCommand,
        remove: RemoveStreamerCommand,
        setchannel: SetChannelCommand
    };

    /**
     * TwitchHook constructor
     */
    constructor() {
        // Fetch the bot token from the environment
        this.botToken = process.env.BOT_TOKEN;

        // Fetch the twitch client id from the environment
        this.twitchClientId = process.env.TWITCH_CLIENT_ID;

        // Fetch the twitch client secret from the environment
        this.twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;

        // Create the bot
        this.bot =  new Discord.Client();

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

        // Ensure we have a twitch client secret
        if (_.isEmpty(this.twitchClientSecret)) {
            console.error("Please provide a TWITCH_CLIENT_SECRET inside the .env file");
        }

        // Twitch client instance
        this.twitch = TwitchClient.withClientCredentials(this.twitchClientId, this.twitchClientSecret);

        // Initialise the database
        await this.database.init();

        // Migrate the database
        await this.database.migrate();

        // Connect the bot
        await this.connect();

        // Add any discord commands
        this.initCommands();

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
            this.database.run("INSERT INTO servers (server_id, created_at) VALUES (?, ?)", guild.id, moment().format('Y-m-d H:m:s'));
        });

        // Add an event when this bot is removed from a server
        this.bot.on("guildDelete", (guild) => {
            console.log("Left guild: " + guild.name);
            this.database.run("DELETE FROM servers WHERE server_id = ?", guild.id);
        });

        // Create the LiveMessage instance
        this.liveMessage = new LiveMessage(this.database, this.bot, this.twitch);
    }

    /**
     * Start the bot
     */
    start() {
        // Run immediately
        this.liveMessage.checkLiveMessages().catch(console.error);

        // Star the timeout
        setInterval(() => {
            this.liveMessage.checkLiveMessages().catch(console.error);
        }, 15000);
    }

    /**
     * Initialise all the bots commands
     */
    initCommands() {
        this.bot.commands = new Discord.Collection();
        this.bot.commands.set('add', 0);

        // Catch the message event
        this.bot.on('message', (message) => {
            // Command prefix
            let prefix = "!twitchhook";

            // Ensure this message starts with out prefix
            if (message.content.trim().startsWith(prefix)) {
                // Fetch the arguments of the command
                const args = message.content.replace(`${prefix} `, "").split(" ");

                // Fetch the command
                const command = args.shift().toLowerCase().replace(prefix, '');

                // Check to see if this command exists
                if (this.commands[command] !== undefined) {
                    // If the command exists, create the command class and execute it
                    (new this.commands[command](this, message)).execute(...args);
                } else {
                    message.channel.send("Available commands: setchannel, add, remove, list");
                }
            }
        });
    }
}

module.exports = TwitchHook;