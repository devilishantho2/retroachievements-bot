# Cheevos tracker
Discord bot allowing users to share in real time their latest achievements earned on www.retroachievements.org

##

## Dependencies
This bot is using __Node.js v22.22.0__, use __npm install__ to install all dependencies\
The bot must have "view channels", "send messages" and "attach files" permissions to function properly.

## Deployment
To use this bot for yourself, you must first create a `.env` file at the root of the project :
```python
#Bot credentials
DISCORD_TOKEN = your_discord_bot_token
CLIENT_ID = your_discord_bot_client_id

#Retroachievements credentials (used for some api requests)
RA_USERNAME = your_ra_username
RA_API_KEY = your_ra_api_key

#Server and channel you want the important logs to be sent (bot must be in the server)
LOG_GUILD_ID = your_server_id
LOG_CHANNEL_ID = your_channel_id
```
Then rename the folder `/data-example` to `/data` (it contains all the necessary files to save users/guilds data)

Finally run those commands in order : 
* node deploy_commands.js
* node index.js

## 

## Server setup (admin commands)
Once the bot added to a server, admins must define the language of their server (default is english) with __/admin language__ (currently available language : English, French), and the channel where achievements will be sent with __/admin setchannel__ in the correct channel.\
Admins can also decide whether or not they want to receive notifications of global 100 points achievements in their server by running the command __/admin notifications <True/False>__

Other commands :
* __/admin remove <discord_id>__ : stop the achievements of a specific user from being sent in your server
* __/admin clear__ : stop the achievements of the user no longer in your server from being sent

## User setup (register and customization)
User must register with __/register <username> <api_key>__ for the bot to start sending their achievements. They must provide their current retroachievements username and their personal web API key (can be found on the website in settings -> authentication) \
User must register in each server they want their achievements to be send.
To leave the bot, use __/leave <server/bot>__ (__/leave server__ stops the notifications in the server you're in, __/leave bot__ deletes all your data permanently)

Once registered, user can customize their own achievements notifications :
* __/customize background <url>__ : change the background of the user's notifications. Multiple format accepted such as .png .jpg and so on. Format recommended : 800*250
* __/customize color <#RRVVBB>__ : change the color of the text displayed on the user's notifications. Format : #RRVVBB

## Other commands
#### Retroachievements
* __/aotm__, __/aotw__ : shows informations on the current achievement of the week/month
* __/profile (<username>)__ : shows the informations of an user (stats, latest game played, latest achievements earned, latest mastery/completion, favorite game/achievement)

#### Misc
* __/help__ : shows all the commands and their purpose
* __/vote__ : shows the link to top.gg to vote
* __/stats__ : shows the stats of the bot since the beginning
* __/apigraph <day/month>__ : shows the number of api request made by hour or by day
* __/ping__ : pong!