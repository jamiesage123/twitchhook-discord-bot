# TwitchHook Discord bot
This repository contains the source code for a discord bot that notifies a channel when a user goes live on twitch. It also provides a [multistre.am](https://multistre.am/) link if there are multiple users streaming.

This bot is work in progress and should not be used in a production environment.

## Installation
This bot is written to run on top of node.js. Please see [https://nodejs.org/](https://nodejs.org/en/download/) for more information on node.js.

Run `npm install` in the root directory to install all the bots dependencies.

Once you have the dependencies, you wil need to create a new application on discord along with a bot for the application. This can be done via [Discord Developer Portal](https://discordapp.com/developers/).

You will also need to create a Twitch Application in order to use their API. This can be done via the [Twitch Developers Portal](https://dev.twitch.tv/).

Once you have your Discord and Twitch applications set up, rename the `.env.example` file (located in the root directory) to `.env` and set the `BOT_TOKEN` to your Discord applications bot token, the `TWITCH_CLIENT_ID` to your Twitch applications client id and the `TWITCH_CLIENT_SECRET` to your Twitch application secret.

Now, run `npm run start` to start the bot.

You will need to invite the bot to your server. The bot needs at least "Send Message", "Manage Messages" and "Embed Links" permissions.

## Comands
All commands are prefixed with `!twitchhook` followed by the command and its arguments (`!twitchhook add DrDisrespect`)

Available commands:  
`!twitchhook setchannel` - Set the current channel as the channel to notify when a user goes live  
`!twitchhook add [username]` - Add  a twitch user to the list of streamers that will notify to the channel  
`!twitchhook remove [username]` - Remove a twitch streamer  
`!twitchhook list` - List all twitch streamers  
