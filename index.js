// Require the necessary discord.js classes
import { Client, GatewayIntentBits, Partials, Events, UserFlags, AuditLogEvent, WebhookClient } from 'discord.js';

import JSONdb from 'simple-json-db';
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from 'url';
import JSON5 from "json5"

const dirname = path.dirname(fileURLToPath(import.meta.url));

const db = new JSONdb('./exeInfo.json');

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

const whitelist = await fs.readFile(dirname + "/whitelist.json")

client.on(Events.GuildMemberAdd, async member => {
  if (member.guild.id !== 1216816878937313442) return;
  if (member.user.bot && !member.user.flags.has(UserFlags.VerifiedBot) && !whitelist.includes(member.id.toString())) {
    member.kick("Not verified")
  }
})

  const handleKick = async (guild, executor) => {
    if (executor.id === 1097331115217403924) {
      return
    }
      let exeInfo = null
      if (db.has(executor.id+"")) {
        exeInfo = db.get(executor.id+"")
      } else {
        exeInfo = {
          lastHour: +Date.now(),
          kicks: 0
        }
      }
      if (Date.now() -exeInfo.lastHour >= 1000 * 60 * 60) {
        exeInfo = {
          lastHour: +Date.now(),
          kicks: 0
        }
      }
      exeInfo.kicks += 1
      db.set(executor.id+"", exeInfo)
      if (exeInfo.kicks >= 2) {
        const exemem = await guild.members.fetch(executor)
        exemem.kick("Too many kicks in an hour")
      } 
  }

client.on(Events.GuildMemberRemove, async member => {
  if (member.guild.id !== 1216816878937313442) return;
    const fetchedLogs = await member.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberKick,
    });

    const kickLog = fetchedLogs.entries.first();

    if (!kickLog) return 

    const { executor, target } = kickLog;

    if (kickLog.createdAt < member.joinedAt) { 
        return
    }

    // And now we can update our output with a bit more information
    // We will also run a check to make sure the log we got was for the same kicked member
    if (target.id === member.id) {
      await handleKick(member.guild, executor)
    } else {
        return
    }
});


client.on(Events.GuildBanAdd, async (ban) => {
  if (member.guild.id !== 1216816878937313442) return;
    const fetchedLogs = await ban.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberBan,
    });

    const banLog = fetchedLogs.entries.first();

    if (!banLog) return 

  const { executor, target } = banLog;

  await handleKick(ban.guild, executor)

})

const messageMap = new JSONdb("./map.json")

const webhookData = JSON5.parse(await fs.readFile(dirname + "/webhooks.json"))
client.on(Events.MessageCreate, async message => {
  if (message.content === "" && message.attachments.size === 0 && message.stickers.size === 0) return
  for (const [index, group] of webhookData.entries()) {
    const current = group.find(webhook => webhook.channel === message.channel.id)
    if (!current) continue
    if (message.webhookId === current.webhook.split("/")[5]) return
    const currMap = {}
    console.log(group)
    for (const channelData of group) {
      if (channelData.channel === current.channel) continue
      const webhookClient = new WebhookClient({ url: channelData.webhook });
      currMap[channelData.channel] = (await webhookClient.send({
        "content": message.content,
        "embeds": message.embeds,
        "allowedMentions": {
          "parse": [],
          "users": [],
          "roles": []
        },
        "files": [...message.attachments.values(), ...message.stickers.mapValues(sticker => sticker.url).values()],
        "username": message.author.displayName + " - " + current.name,
        "avatarURL": message.author.avatarURL()
      })).id
    }
    currMap.group = index
    messageMap.set(message.id, currMap)
  }
})

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (newMessage.content === "" && newMessage.attachments.size === 0 && newMessage.stickers.size === 0) return
  const cached = messageMap.get(newMessage.id)
  if (!cached) return
  console.log(cached)
  const group = webhookData[cached.group]
  for (const channelData of group) {
    const messageID = cached[channelData.channel]
    if (!messageID) continue;
    const webhookClient = new WebhookClient({ url: channelData.webhook });
    await webhookClient.editMessage(messageID, {
      "content": newMessage.content,
      "embeds": newMessage.embeds,
      "files": newMessage.file
    })
  }
})
client.on(Events.MessageDelete, async message => {
  if (message.content === "" && message.attachments.size === 0 && message.stickers.size === 0) return
  const cached = messageMap.get(message.id)
  if (!cached) return
  console.log(cached)
  const group = webhookData[cached.group]
  for (const channelData of group) {
    const messageID = cached[channelData.channel]
    if (!messageID) continue;
    const webhookClient = new WebhookClient({ url: channelData.webhook });
    await webhookClient.deleteMessage(messageID)
  }
})
import express from 'express';
const app = express(); 

app.get('/*?', (req, res) => {
  res.send('online')
})

app.listen(3000, () => { // Listen on port 3000
    console.log('Listening!') // Log when listen success
})