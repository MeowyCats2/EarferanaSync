// Require the necessary discord.js classes
import { Client, GatewayIntentBits, Partials, Events, UserFlags, AuditLogEvent } from 'discord.js';

// Create a new client instance
const client = new Client({
    intents: [GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration,
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent],
  }); // creates a new bot client

client.once(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

console.log("Logging in...")
await client.login(process.env.token)
console.log("Logged in!")
export default client