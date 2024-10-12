// Require the necessary discord.js classes
import { Client, GatewayIntentBits, Partials, Events, UserFlags, AuditLogEvent, PermissionsBitField, MessageType, Routes, SlashCommandBuilder, SlashCommandBooleanOption } from 'discord.js';

import JSONdb from 'simple-json-db';
import JSZip from "jszip"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from 'url';
import "./syncing.js"
import { dataMsg, dataContent } from "./dataMsg.js"

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
  if (!message.channel.permissionsFor(message.author).has(PermissionsBitField.Flags.ManageMessages)) message.reply("You need the Manage Messages permission.")
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
  if (!message.channel.permissionsFor(message.author).has(PermissionsBitField.Flags.ManageMessages)) message.reply("You need the Manage Messages permission.")
  await archivalExtract(archivalInfo.push({}) - 1, message)
})

const archivalExtract = async (index, message, webhook, start) => {
  const zip = await JSZip.loadAsync(await (await fetch([...message.attachments.values()][0].url)).arrayBuffer())
  const messages = JSON.parse(await zip.file("messages.json").async("string"))
  const authors = JSON.parse(await zip.file("authors.json").async("string"))
  if (!webhook) webhook = await message.channel.createWebhook({
    "name": "Message Archive Extraction",
    "reason": "Extracting message archive"
  })
  let shouldSend = !start
  const latestMsg = (await message.channel.messages.fetch({ limit: 1 })).first()
  for (const current of messages) {
    if (!shouldSend) {
      if (start === current.id) {
        shouldSend = true
        if (latestMsg.content === current.content) continue
      } else {
        continue
      }
    }
    archivalInfo[index] = {
      "type": "extract",
      "message": message.id,
      "channel": message.channel.id,
      "webhook": webhook.id,
      "current": current.id
    }
    await (await archivalInfoMsg()).edit(JSON.stringify(archivalInfo))
    const files = []
    for (const attachment of current.attachments) {
      files.push({
        "name": attachment.name,
        "attachment": await zip.file(attachment.file).async("nodebuffer"),
        "description": attachment.description
      })
    }
    await webhook.send({
      "username": authors[current.author].displayName.replace(/discord/ig, "D1scord"),
      "avatarURL": authors[current.author].avatarURL || authors[current.author].defaultAvatarURL,
      "content": current.content.substring(0, 2000),
      "embeds": current.embeds,
      "allowedMentions": {
        "parse": [],
        "users": [],
        "roles": []
      },
      "files": files
    })
  }
  archivalInfo[index] = null
}
client.on(Events.MessageCreate, async message => {
  if (!message.content.startsWith("$copy") || message.author.bot) return
  const source = await client.channels.fetch(message.content.split(" ")[1])
  await source.guild.members.fetch(message.author)
  if (!source.permissionsFor(message.author).has(PermissionsBitField.Flags.ManageMessages)) message.reply("You need the Manage Messages permission in the source.")
  if (!message.channel.permissionsFor(message.author).has(PermissionsBitField.Flags.ManageMessages)) message.reply("You need the Manage Messages permission.")
  await archivalCopy(archivalInfo.push({}) - 1, source, message.channel.id, message)
})

const archivalCopy = async (index, source, destination, message, webhook, start) => {
  let messages = [...(await source.messages.fetch({"limit": 100})).sort((a, b) => b.createdAt - a.createdAt).values()].reverse()
  if (messages.length === 0) {
    if (message) return await message.channel.send("No messages found.")
    return
  }
  if (message) {
    try {
      await message.delete()
    } catch (e) {
    }
  }
  while (1) {
    const fetched = [...(await source.messages.fetch({"limit": 100, "before": messages[0].id})).sort((a, b) => b.createdAt - a.createdAt).values()].reverse()
    if (fetched.length === 0) break
    messages.unshift(...fetched)
  }
  if (!webhook) webhook = await message.channel.createWebhook({
    "name": "Message Archive Copying",
    "reason": "Copying messages"
  })
  let shouldSend = !start
  const latestMsg = (await (await client.channels.fetch(destination)).messages.fetch({ limit: 1 })).first()
  for (const current of messages) {
    if (!shouldSend) {
      if (start === current.id) {
        shouldSend = true
        if (latestMsg.content === current.content) continue
      } else {
        continue
      }
    }
    archivalInfo[index] = {
      "type": "copy",
      "source": source.id,
      "destination": destination,
      "webhook": webhook.id,
      "current": current.id
    }
    await (await archivalInfoMsg()).edit(JSON.stringify(archivalInfo))
	if (current.system) {
		await webhook.send({
			"content": MessageType[current.type],
			  "username": current.author.displayName.replace(/discord/ig, "D1scord"),
			  "avatarURL": current.author.avatarURL()
		})
		continue
	}
    await webhook.send({
      "content": current.content.substring(0, 2000),
      "embeds": current.embeds.filter(embed => embed.data.title || embed.data.description || embed.data.footer || embed.data.thumbnail || embed.data.image || embed.data.video || embed.data.video || embed.data.fields),
      "allowedMentions": {
        "parse": [],
        "users": [],
        "roles": []
      },
      "files": [...current.attachments.values(), ...current.stickers.mapValues(sticker => sticker.url).values()],
      "username": current.author.displayName.replace(/discord/ig, "D1scord"),
      "avatarURL": current.author.avatarURL()
    })
  }
  archivalInfo[index] = null
}

client.on(Events.MessageCreate, async message => {
  if (message.content !== "$clear" || message.author.bot) return
  await (await archivalInfoMsg()).edit(JSON.stringify([]))
  process.exit();
})

import express from 'express';
const app = express(); 

app.get('/*?', (req, res) => {
  res.send('online')
})

app.listen(3000, () => { // Listen on port 3000
    console.log('Listening!') // Log when listen success
})
//const rest = new REST().setToken(process.env.token);
//console.log(JSON.stringify((await client.rest.get("/channels/1001902549248512221/messages/1227396718216351756")).poll, null, 4))
//console.log((await (await client.channels.fetch("1001902549248512221")).messages.fetch("1227396718216351756")).poll)

client.on(Events.MessageCreate, async message => {
  if (!message.content.startsWith("$poll") || message.author.bot) return
  if (!message.channel.permissionsFor(message.author).has(PermissionsBitField.Flags.ManageMessages)) return message.reply("You need the Manage Messages permission.")
  const options = message.content.replace(/^\$poll\s/, "").split("|")
  if (options.length < 2) return message.reply("Not enough command options.")
  try {
    await client.rest.post("/channels/" + message.channel.id + "/messages", {
	  "body": {
		"tts": false,
		"flags": 0,
		"poll": {
			"question":{"text":options[0]},
			"answers": options[1].split(";").map(answer => {
				const nativeEmojiMatch = answer.match(/^\s?(\p{Extended_Pictographic})/u)
				const customEmojiMatch = answer.match(/^\s?<:.+?:([0-9]+)>/)
				const idEmojiMatch = answer.match(/^\s?\{([0-9]+)\}/)
				if (nativeEmojiMatch) return {
					"poll_media": {
						"text": answer.split(nativeEmojiMatch[0])[1],
						"emoji": {
						//"id":
							"name": nativeEmojiMatch[1]
						}
					}
				}
				if (customEmojiMatch) return {
					"poll_media": {
						"text": answer.split(customEmojiMatch[0])[1],
						"emoji": {
							"id": customEmojiMatch[1],
							"name": ""
						}
					}
				}
				if (idEmojiMatch) return {
					"poll_media": {
						"text": answer.split(idEmojiMatch[0])[1],
						"emoji": {
							"id": idEmojiMatch[1],
								"name": ""
						}
					}
				}
				return {
					"poll_media": {
						"text": answer
					}
				}
			}),
			"allow_multiselect": options[2] && (options[2].toLowerCase().includes("t") || options[2].toLowerCase().includes("y") || options[2].toLowerCase().includes("m")),
			"duration": options[3] || 24,
			"layout_type": options[4] || 1
		}
	  }
    })
  } catch (e) {
	  message.reply(e.message)
  }
});


const performIncidentActions = async () => {
	const tommorow = new Date();
tommorow.setDate((new Date()).getDate() + 1)
	for (const guild of dataContent.perpetualIncidentActions) {
		console.log(await client.rest.put("/guilds/" + guild.guildId + "/incident-actions", {
			"body": {"invites_disabled_until": guild.disable_invites ? tommorow.toISOString() : null, "dms_disabled_until": guild.disable_dms ? tommorow.toISOString() : null}
		}))
	}
};
if (Math.abs(dataContent.lastRun - new Date()) / 36e5 >= 12) await performIncidentActions();
setInterval(performIncidentActions, 60 * 60 * 12 * 1000);

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
	if (interaction.commandName !== "perpetual_incident_actions") return;
	await interaction.deferReply();
	const existing = dataContent.perpetualIncidentActions.find(guild => guild.guildId === interaction.guildId)
	const guildData = {
		"guildId": interaction.guildId,
		"disable_invites": interaction.options.get("disable_invites")?.value ?? existing?.disable_invites ?? false,
		"disable_dms": interaction.options.get("disable_dms")?.value ?? existing?.disable_dms ?? false
	}
	if (existing) {
	const index = dataContent.perpetualIncidentActions.findIndex(guild => guild.guildId === interaction.guildId)
	if (guildData.disable_invites || guildData.disable_dms) {
		dataContent.perpetualIncidentActions[index] = guildData;
		} else {
		dataContent.perpetualIncidentActions.splice(index, 1)
		}
	} else if (guildData.disable_invites || guildData.disable_dms) dataContent.perpetualIncidentActions.push(guildData)
	await dataMsg.edit(JSON.stringify(dataContent))
	await interaction.followUp("Configured.")
})


const archivalInfoMsg = async () => await (await client.channels.fetch("1225939024481619988")).messages.fetch("1225939476447100988")

const archivalInfo = JSON.parse((await archivalInfoMsg()).content).filter(task => task)

for (const [index, task] of archivalInfo.entries()) {
  if (task.type === "copy") {
    try {
      await archivalCopy(index, await client.channels.fetch(task.source), task.destination, null, (await (await client.channels.fetch(task.destination)).fetchWebhooks()).get(task.webhook), task.current)
    } catch (e) {
      console.error(e)
    }
  } else if (task.type === "extract") {
    await archivalExtract(index, await (await client.channels.fetch(task.channel)).messages.fetch(task.message), (await (await client.channels.fetch(task.channel)).fetchWebhooks()).get(task.webhook), task.current)
  }
}

const commands = [
	new SlashCommandBuilder()
	.setName("perpetual_incident_actions")
	.setDescription("Enabling incident actions forever.")
	.addBooleanOption(
		new SlashCommandBooleanOption()
		.setName("disable_invites")
		.setDescription("Should disable invites?")
	)
	.addBooleanOption(
		new SlashCommandBooleanOption()
		.setName("disable_dms")
		.setDescription("Should disable DMs?")
	)
]
await client.rest.put(Routes.applicationCommands(client.application.id), {"body": commands})

dataContent.lastRun = (new Date()).toISOString();
await dataMsg.edit(JSON.stringify(dataContent))