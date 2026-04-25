require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const clientId = process.env.CLIENT_ID;
const guildId = '1491942895052263504';

(async () => {
  const guildCommands = await rest.get(
    Routes.applicationGuildCommands(clientId, guildId)
  );

  const globalCommands = await rest.get(
    Routes.applicationCommands(clientId)
  );

  console.log('GUILD COMMANDS:', guildCommands.length);
  console.log(guildCommands.map(c => c.name));

  console.log('GLOBAL COMMANDS:', globalCommands.length);
  console.log(globalCommands.map(c => c.name));
})();