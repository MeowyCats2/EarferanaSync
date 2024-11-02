import { Events, PermissionsBitField, MessageType } from 'discord.js';
import type { GuildChannel, Message, Webhook, TextChannel, TextBasedChannel } from "discord.js"
import JSZip from "jszip"

import client from "./client.ts"
client.on(Events.MessageCreate, async message => {
    if (message.content !== "$archive" || message.author.bot) return
    if (!(message.channel as GuildChannel).permissionsFor(message.author)?.has(PermissionsBitField.Flags.ManageMessages)) message.reply("You need the Manage Messages permission.")
    let messages = [...(await message.channel.messages.fetch({"limit": 100})).sort((a, b) => b.createdTimestamp - a.createdTimestamp).values()].reverse()
    if (messages.length === 0) return await message.channel.send("No messages found.")
    message.reply("Fetching messages...")
    while (1) {
        const fetched = [...(await message.channel.messages.fetch({"limit": 100, "before": messages[0].id})).sort((a, b) => b.createdTimestamp - a.createdTimestamp).values()].reverse()
        if (fetched.length === 0) break
        messages.unshift(...fetched)
    }
    message.reply("Parsing messages...")
    const zip = new JSZip()
    let parsedMessages = []
    let authors: Record<string, object> = {}
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
        for (const sticker of current.stickers.values()) {
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
        if (current.author.avatarURL()) zip.file(current.author.id, await (await fetch(current.author.avatarURL()!)).arrayBuffer())
        const defaultAvatar = current.author.defaultAvatarURL.split("/").at(-1)
        if (defaultAvatar && !zip.file(defaultAvatar)) zip.file(defaultAvatar, await (await fetch(current.author.defaultAvatarURL)).arrayBuffer())
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
    messages = [];
    zip.file("messages.json", JSON.stringify(parsedMessages))
    zip.file("authors.json", JSON.stringify(authors))
    message.reply("Compressing...")
    parsedMessages = [];
    authors = {};
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
    if (!(message.channel as GuildChannel).permissionsFor(message.author)?.has(PermissionsBitField.Flags.ManageMessages)) message.reply("You need the Manage Messages permission.")
    await archivalExtract(archivalInfo.push({}) - 1, message)
})

const archivalExtract = async (index: number, message: Message, webhook?: Webhook, start?: boolean) => {
const zip = await JSZip.loadAsync(await (await fetch([...message.attachments.values()][0].url)).arrayBuffer())
if (!zip.file("messages.json") || !zip.file("authors.json")) return void await message.reply("Invalid format?")
const messages = JSON.parse(await zip.file("messages.json")!.async("string"))
const authors = JSON.parse(await zip.file("authors.json")!.async("string"))
if (!webhook) webhook = await (message.channel as TextChannel).createWebhook({
    "name": "Message Archive Extraction",
    "reason": "Extracting message archive"
})
let shouldSend = !start
const latestMsg = (await message.channel.messages.fetch({ limit: 1 })).first()
for (const current of messages) {
    if (!shouldSend) {
        if (start === current.id) {
            shouldSend = true
            if (latestMsg?.content === current.content) continue
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
        if (!zip.file(attachment.file)) continue;
        files.push({
            "name": attachment.name,
            "attachment": await zip.file(attachment.file)!.async("nodebuffer"),
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
    if (!source || !("guild" in source)) return void await message.reply("Source not found.")
    await source.guild.members.fetch(message.author)
    if (!source.permissionsFor(message.author)?.has(PermissionsBitField.Flags.ManageMessages)) message.reply("You need the Manage Messages permission in the source.")
    if (!(message.channel as GuildChannel).permissionsFor(message.author)?.has(PermissionsBitField.Flags.ManageMessages)) message.reply("You need the Manage Messages permission.")
    await archivalCopy(archivalInfo.push({}) - 1, source as TextBasedChannel, message.channel.id, message)
})

const archivalCopy = async (index: number, source: TextBasedChannel, destination: string, message: Message<boolean> | null, webhook?: Webhook, start?: string) => {
let messages = [...(await source.messages.fetch({"limit": 100})).sort((a, b) => b.createdTimestamp - a.createdTimestamp).values()].reverse()
if (messages.length === 0) {
    if (message) return await (message.channel as TextChannel).send("No messages found.")
    return
}
if (message) {
    try {
        await message.delete()
    } catch (e) {
    }
}
while (1) {
    const fetched = [...(await source.messages.fetch({"limit": 100, "before": messages[0].id})).sort((a, b) => b.createdTimestamp - a.createdTimestamp).values()].reverse()
    if (fetched.length === 0) break
    messages.unshift(...fetched)
}
if (!webhook && message) webhook = await (message.channel as TextChannel).createWebhook({
    "name": "Message Archive Copying",
    "reason": "Copying messages"
})
let shouldSend = !start
if (!await client.channels.fetch(destination)) return void await message?.reply("Destination not found.")
const latestMsg = (await (await (await client.channels.fetch(destination)) as TextChannel).messages.fetch({ limit: 1 })).first()
for (const current of messages) {
    if (!shouldSend) {
        if (start === current.id) {
            shouldSend = true
            if (latestMsg!.content === current.content) continue
        } else {
            continue
        }
    }
    archivalInfo[index] = {
        "type": "copy",
        "source": source.id,
        "destination": destination,
        "webhook": webhook?.id,
        "current": current.id
    }
    await (await archivalInfoMsg()).edit(JSON.stringify(archivalInfo))
    if (current.system) {
        await webhook?.send({
            "content": MessageType[current.type],
            "username": current.author.displayName.replace(/discord/ig, "D1scord"),
            "avatarURL": current.author.avatarURL()!
        })
        continue
    }
    await webhook?.send({
        "content": current.content.substring(0, 2000),
        "embeds": current.embeds.filter(embed => embed.data.title || embed.data.description || embed.data.footer || embed.data.thumbnail || embed.data.image || embed.data.video || embed.data.video || embed.data.fields),
        "allowedMentions": {
            "parse": [],
            "users": [],
            "roles": []
        },
        "files": [...current.attachments.values(), ...current.stickers.mapValues(sticker => sticker.url).values()],
        "username": current.author.displayName.replace(/discord/ig, "D1scord"),
        "avatarURL": current.author.avatarURL()!
    })
}
archivalInfo[index] = null
}

client.on(Events.MessageCreate, async message => {
    if (message.content !== "$clear" || message.author.bot) return
    await (await archivalInfoMsg()).edit(JSON.stringify([]))
    process.exit();
})


const archivalInfoMsg = async () => await ((await client.channels.fetch("1225939024481619988")) as TextChannel).messages.fetch("1225939476447100988")

interface CopyTask {
    type: "copy",
    source: string,
    destination: string,
    webhook: string,
    current: string
}
interface ExtractTask {
    type: "extract",
    channel: string,
    webhook: string,
    current: string
}
const archivalInfo = JSON.parse((await archivalInfoMsg()).content).filter((task: ExtractTask) => task)

for (const [index, task] of archivalInfo.entries()) {
  if (task.type === "copy") {
    if (!await client.channels.fetch(task.source) || !await client.channels.fetch(task.destination)) continue
    try {
      await archivalCopy(index, await client.channels.fetch(task.source) as TextBasedChannel, task.destination, null, (await (await client.channels.fetch(task.destination) as TextChannel).fetchWebhooks()).get(task.webhook), task.current)
    } catch (e) {
      console.error(e)
    }
  } else if (task.type === "extract") {
    if (!await client.channels.fetch(task.channel)) continue
    await archivalExtract(index, await (await client.channels.fetch(task.channel) as TextChannel).messages.fetch(task.message), (await (await client.channels.fetch(task.channel) as TextChannel).fetchWebhooks()).get(task.webhook), task.current)
  }
}