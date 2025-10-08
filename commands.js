// stores commands and functionality

const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('create_json')
      .setDescription('Creates a ban JSON file out of the given list of user IDs')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(option =>
        option
          .setName('user_ids')
          .setDescription('Comma-separated list of user IDs')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('ban_reason')
          .setDescription('Reason of ban. Will be used in every created ban else a default.')
          .setRequired(false)
      ),
    async execute(interaction, client) {
      const uids = interaction.options.getString('user_ids');
      const reason = interaction.options.getString('ban_reason') || "No reason given";

      let json_out = {} // holds gererated JSON stuff
      let missed = 0 // missed usernames it couldn't fetch

      // take all of the given user ids and iterate over them and put their stuff into the object
      for (let uid of uids.split(",")) {
        uid = uid.trim();
        if (!uid) continue;

        let resolved_username

        try {
          resolved_username = (await interaction.guild.members.fetch(uid)).user.username
        } catch {
          resolved_username = "Unknown"
          missed += 1
        }
        json_out[uid] = {
            "username": String(resolved_username),
            "reason": reason
        }
      };

      // turn the object into stringified JSON then use fs to create a temp .json file to export to circumvent discord's character limit (and contain the json nicely)
      json_out = JSON.stringify(json_out, null, 1)
      const construct = `./!${interaction.guildId}_custom_banlist.json`
      fs.writeFileSync(construct, json_out, 'utf8')

      // weird js jank where you can say not not missed (!!missed) to force bool, avoids weird string garbage
      interaction.reply({ files: [construct], content: !!missed ? `Failed to fetch ${missed} user(s) during generation; either unexpected error or not in guild` : "Successfully processed all usernames" })
        .then(() => {
        fs.rm(construct, (err) => {
            if (err) console.error(`Failed to remove temp custom: ${err}`);
        });
      });
    },
  },
  {
    data: new SlashCommandBuilder()
    .setName("export_bans")
    .setDescription("Export the server's banlist as JSON")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {
      if (!interaction.guild) return interaction.reply("This command must be used in a server");
      const guild = interaction.guild

      let json_out = {} // given the output json and sent to the user
      let missed = 0 // missed ban fetches (should be 0 usually, no reason to fail)
      let bans // would make const but too dumb for that!!

      // try to get the now validated guild's banlist and process all the users
      try {
        bans = await guild.bans.fetch();
      } catch (err) {
        console.error(`Failed to fetch banlist of ${guild.name}: ${err}`)
        await interaction.reply("Failed to fetch the banlist of the guild")
        return;
      };

      // log every banned member in the JSON
      bans.forEach(ban => {
        try {
          const username = ban.user.username
          const reason = ban.reason || "No reason given"
          json_out[ban.user.id] = {
            "username":username,
            "reason":reason
          }
        } catch {
          missed += 1
        }
      });
      json_out = JSON.stringify(json_out, null, 1)
      const construct = `./!${interaction.guild.id}_exported_banlist.json`
      fs.writeFileSync(construct, json_out, 'utf8')

      await interaction.reply({ files: [construct], content: !!missed ? `Failed to log ${missed} user(s) in export` : "Successfully exported full banlist" })
      .then(() => {
        fs.rm(construct, (err) => {
          console.error(`Failed to remove temp export: ${err}`)
        });
      });
    }
  },
  {
    data: new SlashCommandBuilder ()
      .setName("import_bans")
      .setDescription("Import ban JSON to automatically ban users in the server. Allows filtering.")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addAttachmentOption(option => 
        option
          .setName("json_file")
          .setDescription("Your banlist JSON file")
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("filter")
          .setDescription("Optionally, filter bans. No filter will ban everyone if possible.")
          .addChoices(
            { name:"In Server", value:"in" },
            { name:"Not In Server", value:"out" }
          )
          .setRequired(false)
      ),
      async execute(interaction, client) {
        const attachment = interaction.options.getAttachment("json_file");
        const filter = interaction.options.getString("filter") || "all";
        if (!attachment.name.endsWith(".json")) return interaction.reply("Please send a .json file!");

        // get the attachment JSON
        let json_input
        try {
          const response = await fetch(attachment.url);
          json_input = await response.json();
        } catch (err) {
          console.error(err)
          await interaction.reply("Failed to extract json. Make sure you uploaded the right file.")
          return;
        }

        let missed = 0 // missed users in filtering or banning
        let filtered = 0 // deliberately filtered users
        let total = 0 // total banned users
        let filtered_list = {} // detailed info on who was filtered

        // iterate over every user in the json and filter accordingly
        for (const user in json_input) {
          try {
            const userinfo = json_input[user] // nefarious cheating
            if (filter=="all") {
              await interaction.guild.members.ban(user);
              total += 1
              continue;
            };
            // check if they exist only once and when needed so it can be reused in the next check due to scoping
            const exists = await interaction.guild.members.fetch(user).catch(() => null);
            if (filter=="in") {
              if (exists) {
                await interaction.guild.members.ban(user);
                total += 1
              } else {
                filtered += 1
                filtered_list[userinfo.username] = "Currently not in server"
              }
            } else if (filter=="out") {
              if (!exists) {
                await interaction.guild.members.ban(user);
                total += 1
              } else {
                filtered += 1
                filtered_list[userinfo.username] = "Currently in server"
              }
            };
          } catch (err) {
            console.error(`Failed to ban user in import: ${err}`)
            missed += 1
            filtered_list[userinfo.username] = "Unexpected error or missing permissions"
          };
        };

        // build response message based on useful info
        let construct = `Successfully banned **${total}** users`

        if (filtered) { construct = `${construct}\nFiltered out **${filtered}** users from banlist` }
        if (missed) { construct = `${construct}\nFailed to ban **${missed}** user(s)` }

        if (filtered) {
          construct += `\n\n`;
          for (const [id, reason] of Object.entries(filtered_list)) {
            construct += `\n\`${id}\`: ${reason}`;
          }
        }

        await interaction.reply({ content: construct });
      }
  }
];

module.exports = commands;