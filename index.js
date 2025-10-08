const { Client, REST, Routes, GatewayIntentBits, Events } = require('discord.js');
const { token } = require('./token.json'); // create token.json and add the token there on its own, nowhere else
const { clientId } = require('./config.json') // these require changes depending on the bot you're using
const commands = require('./commands.js'); // used for the commands, clearly

// make the client with guild intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});

// event management

// on client startup
client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in successfully as ${readyClient.user.tag}`);
});

// command stuff

const rest = new REST({ version: '10' }).setToken(token);

// syncing stuff
(async () => {
    try {
        // turn to JSON
        const commandData = commands.map(cmd => cmd.data.toJSON());
        console.log(`Syncing ${commandData.length} commands`);

        // sync stuff to discord
        await rest.put(Routes.applicationCommands(clientId), {
            body: commandData
        });

        console.log("Synced successfully");
    } catch (err) {
        console.error(`Failed to sync commands: ${err}`);
    }
})();

// command processing or handling or whatever you want to call it im tired
client.on(Events.InteractionCreate, async (interaction) => {

    // find command in commands.js if we can - it must strictly match what we want
    const command = commands.find(c => c.data.name === interaction.commandName);

    // after boring checks and command searching, give the interaction to commands.js and hope it works
    try {
        await command.execute(interaction, client);
    } catch (err) {
        console.error(err)
        if (interaction.replied) {
            await interaction.editReply({ content: 'Failed to run command. Try again with different parameters.' })
            return;
        }
        await interaction.reply({ content: 'Failed to run command. Try again with different parameters.' })
    }
});

client.login(token);