// Require the necessary discord.js classes
import { Client, GatewayIntentBits, Partials, Events, UserFlags, AuditLogEvent } from 'discord.js';

import JSONdb from 'simple-json-db';
import JSZip from "jszip"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from 'url';
import "./syncing.js"

const dirname = path.dirname(fileURLToPath(import.meta.url));

const db = new JSONdb('./exeInfo.json');

import client from "./client.js"

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

client.on(Events.MessageCreate, async message => {
  if (message.content !== "$archive" || message.author.bot) return
  let messages = [...(await message.channel.messages.fetch({"limit": 100})).sort((a, b) => b.createdAt - a.createdAt).values()].reverse()
  if (messages.length === 0) return await message.channel.send("No messages found.")
  message.reply("Fetching messages...")
  while (1) {
    const fetched = [...(await message.channel.messages.fetch({"limit": 100, "before": messages[0].id})).sort((a, b) => b.createdAt - a.createdAt).values()].reverse()
    if (fetched.length === 0) break
    messages.unshift(...fetched)
  }
  message.reply("Parsing messages...")
  const zip = new JSZip()
  let parsedMessages = []
  let authors = {}
  for (const current of messages) {
    const attachments = []
    for (const attachment of current.attachments.values()) {
      zip.file(attachment.id + "." + attachment.name.split(".").at(-1), await (await fetch(attachment.url)).arrayBuffer())
      attachments.push({
        "contentType": attachment.contentType,
        "description": attachment.description,
        "name": attachment.name,
        "spoiler": attachment.spoiler,
        "id": attachment.id,
        "url": attachment.url,
        "proxyURL": attachment.proxyURL,
        "file": attachment.id + "." + attachment.name.split(".").at(-1)
      })
    }
    const stickers = []
    for (const sticker of current.attachments.values()) {
      zip.file(sticker.id, await (await fetch(sticker.url)).arrayBuffer())
      stickers.push({
        "createdTimestamp": sticker.createdTimestamp,
        "description": sticker.description,
        "format": sticker.format,
        "guildId": sticker.guildId,
        "id": sticker.id,
        "name": sticker.name,
        "packId": sticker.packId,
        "type": sticker.type,
        "url": sticker.url
      })
    }
    if (!(current.author.id in authors)) {
      if (current.author.avatarURL()) zip.file(current.author.id, await (await fetch(current.author.avatarURL())).arrayBuffer())
      const defaultAvatar = current.author.defaultAvatarURL.split("/").at(-1)
      if (!zip.file(defaultAvatar)) zip.file(defaultAvatar, await (await fetch(current.author.defaultAvatarURL)).arrayBuffer())
      authors[current.author.id] = {
          "avatar": current.author.avatar,
          "avatarURL": current.author.avatarURL(),
          "avatarFile": current.author.avatarURL() ? current.author.id + "avatar" : null,
          "bot": current.author.bot,
          "defaultAvatarURL": current.author.defaultAvatarURL,
          "defaultAvatarFile": current.author.defaultAvatarURL.split("/").at(-1),
          "displayName": current.author.displayName,
          "id": current.author.id
        }
    }
    parsedMessages.push({
      "attachments": attachments,
      "author": current.author.id,
      "content": current.content,
      "createdTimestamp": current.createdTimestamp,
      "editedTimestamp": current.editedTimestamp,
      "embeds": current.embeds.map(embed => embed.data),
      "id": current.id,
      "type": current.type
    })
  }
  message.reply("Stringifying messages...")
  const messagesLength = messages.length
  messages = null;
  zip.file("messages.json", JSON.stringify(parsedMessages))
  zip.file("authors.json", JSON.stringify(authors))
  message.reply("Compressing...")
  parsedMessages = null;
  authors = null;
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE"
  })
  message.reply("Uploading...")
  await message.reply({
    "content": messagesLength + "",
    "files": [
      {
        "name": "archive.zip",
        "attachment": buffer,
        "description": "Archive of the messages"
      }
    ]
  })
})

client.on(Events.MessageCreate, async message => {
  if (message.content !== "$extract" || message.author.bot) return
  if (message.attachments.size === 0) return
  const zip = await JSZip.loadAsync(await (await fetch([...message.attachments.values()][0].url)).arrayBuffer())
  const messages = JSON.parse(await zip.file("messages.json").async("string"))
  const authors = JSON.parse(await zip.file("authors.json").async("string"))
  const webhook = await message.channel.createWebhook({
    "name": "Message Archive Extraction",
    "reason": "Extracting message archive"
  })
  for (const message of messages) {
    const files = []
    for (const attachment of message.attachments) {
      files.push({
        "name": attachment.name,
        "attachment": await zip.file(attachment.file).async("nodebuffer"),
        "description": attachment.description
      })
    }
    await webhook.send({
      "username": authors[message.author].displayName,
      "avatarURL": authors[message.author].avatarURL || authors[message.author].defaultAvatarURL,
      "content": message.content,
      "embeds": message.embeds,
      "allowedMentions": {
        "parse": [],
        "users": [],
        "roles": []
      },
      "files": files
    })
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