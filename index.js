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
        // turn to JSON and log what is going on
        const commandData = commands.map(cmd => cmd.data.toJSON());
        console.log(`Syncing ${commandData.length} commands`);

        // tell discord to do the syncy syncy thingy thingy
        await rest.put(Routes.applicationCommands(clientId), {
            body: commandData
        });

        // no errors wow you're not THAT bad at js
        console.log("Synced successfully");
    } catch (err) {
        // lol you suck
        console.error(`Failed to sync commands: ${err}`);
    }
})();

// command processing or handling or whatever you want to call it im tired
client.on(Events.InteractionCreate, async (interaction) => {
    // if it isnt a chat command then bye bye
    if (!interaction.isChatInputCommand()) return;

    // find command in commands.js if we can - it must strictly match what we want
    const command = commands.find(c => c.data.name === interaction.commandName);
    if (!command) { // if this command doesnt exist (idk how they would be able to send one that doesnt exist i just like flavortext) then send flavortext
        await interaction.reply({ content: `Unknown command \`${interaction.commandName}\`, maybe try something that exists`, ephemeral: true })
        return;
    }

    // after boring checks and command searching, give the interaction to commands.js and hope it works
    try {
        await command.execute(interaction, client);
    } catch (err) {
        // you still suck lol
        console.error(err)
        if (interaction.replied) {
            await interaction.editReply({ content: 'Failed to run command. Try again with different parameters.' })
            return;
        }
        await interaction.reply({ content: 'Failed to run command. Try again with different parameters.' })
    }
});

client.login(token);