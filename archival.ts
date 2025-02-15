import { Events, PermissionsBitField, MessageType } from 'discord.js';
import type { GuildChannel, Message, Webhook, TextChannel, TextBasedChannel, AnyThreadChannel, ChannelType } from "discord.js"
import { mkdir } from "node:fs/promises";
import JSZip from "jszip"

import client from "./client.ts"
import { appendCappedSuffix } from "./syncing.ts"
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

const archivalExtract = async (index: number, message: Message, webhook?: Webhook, start?: string) => {
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

const archivalChunkedArchive = async (messages: Message[], messageUpdate: Message, outputChannel: TextChannel, message: Message, multichannel: boolean) => {
    let lastUpdate = Date.now()
    const chunks = []
    for (let i = 0; i < Math.floor(messages.length / 500); i++) {
        chunks.push(messages.slice(i * 500, i * 500 + 500))
    }
    for (let chunk of chunks) {
        messageUpdate.edit("Uploading attachments...")
        const zip = new JSZip()
        let parsedMessages = []
        let authors: Record<string, object> = {}
        for (const current of chunk) {
            const attachments = []
            for (const attachment of current.attachments.values()) {
                await outputChannel.send({
                    "content": attachment.id,
                    "files": [
                        {
                            "attachment": Buffer.from(await (await fetch(attachment.url)).arrayBuffer()),
                            "description": attachment.description ?? undefined,
                            "name": attachment.name
                        }
                    ]
                })
                attachments.push({
                    "contentType": attachment.contentType,
                    "description": attachment.description,
                    "name": attachment.name,
                    "spoiler": attachment.spoiler,
                    "id": attachment.id,
                    "url": attachment.url,
                    "proxyURL": attachment.proxyURL
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
            if (current.author.avatarURL()) {
                await outputChannel.send({
                    "content": current.author.id,
                    "files": [
                        {
                            "attachment": Buffer.from(await (await fetch(current.author.avatarURL()!)).arrayBuffer()),
                            "name": current.author.avatar ?? "avatar"
                        }
                    ]
                })
            }
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
                "channelName": (current.channel as TextChannel).name,
                "channelId": current.channel.id,
                "content": current.content,
                "createdTimestamp": current.createdTimestamp,
                "editedTimestamp": current.editedTimestamp,
                "embeds": current.embeds.map(embed => embed.data),
                "id": current.id,
                "type": current.type
            })
        }
        messageUpdate.edit("Stringifying messages...")
        const messagesLength = chunk.length
        chunk = [];
        zip.file("options.json", JSON.stringify({multichannel}))
        zip.file("messages.json", JSON.stringify(parsedMessages))
        zip.file("authors.json", JSON.stringify(authors))
        messageUpdate.edit("Compressing...")
        parsedMessages = [];
        authors = {};
        const buffer = await zip.generateAsync({
            type: "nodebuffer",
            compression: "DEFLATE",
            compressionOptions: {
                level: 9
            }
        }, metadata => {
            console.log("progression: " + metadata.percent.toFixed(2) + " %");
            if (Date.now() - lastUpdate > 2000) {
                lastUpdate = Date.now()
                messageUpdate.edit("Compressing... " + metadata.percent.toFixed(2) + "%")
            }
        })
        messageUpdate.edit("Uploading...")
        await outputChannel.send({
            "content": "archive",
            "files": [
                {
                    "name": "archive.zip",
                    "attachment": buffer,
                    "description": "Archive of the messages"
                }
            ]
        })
    }
}

client.on(Events.MessageCreate, async message => {
    if (!message.content.startsWith("$chunked_archive ") || message.author.bot) return
    if (!(message.channel as GuildChannel).permissionsFor(message.author)?.has(PermissionsBitField.Flags.ManageMessages)) message.reply("You need the Manage Messages permission.")
    const channelId = message.content.split(" ")[1].match(/[0-9]+/)?.[0]
    if (!channelId) return await message.reply("Invalid channel id")
    const outputChannel = await client.channels.fetch(channelId) as TextChannel | null
    if (!outputChannel) return await message.reply("Invalid channel!")
    const botPerms = (outputChannel as GuildChannel).permissionsFor(outputChannel.guild.members.me!)
    if (!botPerms?.has(PermissionsBitField.Flags.SendMessages) || !botPerms?.has(PermissionsBitField.Flags.AttachFiles)) message.reply("Bot no perms?")  
    let messages = [...(await message.channel.messages.fetch({"limit": 100})).sort((a, b) => b.createdTimestamp - a.createdTimestamp).values()].reverse()
    if (messages.length === 0) return await message.reply("No messages found.")
    const messageUpdate = await message.reply("Fetching messages...")
    let lastUpdate = Date.now()
    while (1) {
        const fetched = [...(await message.channel.messages.fetch({"limit": 100, "before": messages[0].id})).sort((a, b) => b.createdTimestamp - a.createdTimestamp).values()].reverse()
        if (fetched.length === 0) break
        messages.unshift(...fetched)
        if (Date.now() - lastUpdate > 2000) {
            lastUpdate = Date.now()
            messageUpdate.edit("Fetching messages... " + messages.length)
        }
    }
    await archivalChunkedArchive(messages, messageUpdate, outputChannel, message, false)
    message.reply("Finished!")
})


client.on(Events.MessageCreate, async message => {
    if (!message.content.startsWith("$chunked_server_archive ") || message.author.bot) return
    if (!(message.channel as GuildChannel).permissionsFor(message.author)?.has(PermissionsBitField.Flags.ManageMessages)) message.reply("You need the Manage Messages permission.")
    const channelId = message.content.split(" ")[1].match(/[0-9]+/)?.[0]
    if (!channelId) return await message.reply("Invalid channel id")
    const outputChannel = await client.channels.fetch(channelId) as TextChannel | null
    if (!outputChannel) return await message.reply("Invalid channel!")
    const botPerms = (outputChannel as GuildChannel).permissionsFor(outputChannel.guild.members.me!)
    if (!botPerms?.has(PermissionsBitField.Flags.SendMessages) || !botPerms?.has(PermissionsBitField.Flags.AttachFiles)) message.reply("Bot no perms?")  
    const messageUpdate = await message.reply("Fetching messages...")
    let lastUpdate = Date.now()
    const guild = message.guild!
    let guildMessages: Message[] = []
    const channelList = [...(await guild.channels.fetch()).values()]
    for (const [index, channel] of channelList.entries()) {
        console.log(channel!.id + " performing...")
        try {
            const handleMessages = async (textChannel: TextBasedChannel) => {
                let channelMessages = [...(await textChannel.messages.fetch({limit: 100, after: "0"})).sort((a, b) => a.createdTimestamp - b.createdTimestamp).values()]
                if (channelMessages.length === 0) return
                console.log("Message found!")
                while (1) {
                    const fetched = [...(await textChannel.messages.fetch({limit: 100, after: channelMessages.at(-1)!.id})).sort((a, b) => a.createdTimestamp - b.createdTimestamp).values()]
                    if (fetched.length === 0) break
                    console.log("Fetching: " + channelMessages.length + " messages")
                    channelMessages.push(...fetched)
                }
                guildMessages.push(...channelMessages)
            }
            if ("messages" in channel!) await handleMessages(channel as TextBasedChannel)
            if ("threads" in channel!) {
                for (const thread of [...(await channel.threads.fetch()).threads.values()]) {
                    await handleMessages(thread)
                }
            }
            if (Date.now() - lastUpdate > 2000) {
                lastUpdate = Date.now()
                messageUpdate.edit("Fetching messages... " + guildMessages.length + " messages of " + Math.floor(index / channelList.length * 100) + "%")
            }
        } catch (e) {
            console.log(e)
        }
    }
    guildMessages = guildMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    await archivalChunkedArchive(guildMessages, messageUpdate, outputChannel, message, true)
    message.reply("Finished!")
})


client.on(Events.MessageCreate, async message => {
    if (!message.content.startsWith("$server_archive") || message.author.bot) return
    if (!(message.channel as GuildChannel).permissionsFor(message.author)?.has(PermissionsBitField.Flags.ManageMessages)) message.reply("You need the Manage Messages permission.")
    const messageUpdate = await message.reply("Fetching messages...")
    let lastUpdate = Date.now()
    const guild = message.guild!
    let guildMessages: Message[] = []
    const channelList = [...(await guild.channels.fetch()).values()]
    for (const [index, channel] of channelList.entries()) {
        console.log(channel!.id + " performing...")
        try {
            const handleMessages = async (textChannel: TextBasedChannel) => {
                let channelMessages = [...(await textChannel.messages.fetch({limit: 100, after: "0"})).sort((a, b) => a.createdTimestamp - b.createdTimestamp).values()]
                if (channelMessages.length === 0) return
                console.log("Message found!")
                while (1) {
                    const fetched = [...(await textChannel.messages.fetch({limit: 100, after: channelMessages.at(-1)!.id})).sort((a, b) => a.createdTimestamp - b.createdTimestamp).values()]
                    if (fetched.length === 0) break
                    console.log("Fetching: " + channelMessages.length + " messages")
                    channelMessages.push(...fetched)
                    if (Date.now() - lastUpdate > 2000) {
                        lastUpdate = Date.now()
                        messageUpdate.edit("Fetching messages... " + (guildMessages.length + channelMessages.length) + " messages at " + Math.floor(index / channelList.length * 100) + "%")
                    }
                }
                for (const channelMessage of channelMessages) {
                    guildMessages.push(channelMessage)
                }
            }
            if ("messages" in channel!) await handleMessages(channel as TextBasedChannel)
            if ("threads" in channel!) {
                for (const thread of [...(await channel.threads.fetch()).threads.values()]) {
                    await handleMessages(thread)
                }
            }
            if (Date.now() - lastUpdate > 2000) {
                lastUpdate = Date.now()
                messageUpdate.edit("Fetching messages... " + guildMessages.length + " messages at " + Math.floor(index / channelList.length * 100) + "%")
            }
        } catch (e) {
            console.log(e)
        }
    }
    guildMessages = guildMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    const parseUpdate = await message.reply("Downloading attachments and avatars...")
    const files: Record<string, ArrayBufferLike | string> = {}
    let parsedMessages = []
    let authors: Record<string, object> = {}
    for (const [index, current] of guildMessages.entries()) {
        const attachments = []
        if (!message.content.includes("--t")) {
            for (const attachment of current.attachments.values()) {
                files[attachment.id + "." + attachment.name.split(".").at(-1)] = await (await fetch(attachment.url)).arrayBuffer()
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
                files[sticker.id] = await (await fetch(sticker.url)).arrayBuffer()
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
        }
        if (!(current.author.id in authors)) {
        if (current.author.avatarURL()) files[current.author.id] = await (await fetch(current.author.avatarURL()!)).arrayBuffer()
        const defaultAvatar = current.author.defaultAvatarURL.split("/").at(-1)
        if (defaultAvatar && !(defaultAvatar in files)) files[defaultAvatar] = await (await fetch(current.author.defaultAvatarURL)).arrayBuffer()
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
            "channelName": (current.channel as TextChannel).name,
            "channelId": current.channel.id,
            "content": current.content,
            "createdTimestamp": current.createdTimestamp,
            "editedTimestamp": current.editedTimestamp,
            "embeds": current.embeds.map(embed => embed.data),
            "id": current.id,
            "type": current.type
        })
        if (Date.now() - lastUpdate > 2000) {
            lastUpdate = Date.now()
            parseUpdate.edit("Downloading attachments and avatars... " + index + " messages at " + Math.floor(index / guildMessages.length * 100) + "%")
        }
    }
    message.reply("Fetching channels...");
    const channels: Record<string, {
        parentId?: string | null,
        parentName?: string,
        nsfw: boolean | null,
        position: number,
        rawPosition: number,
        url: string,
        topic: string | null,
        name: string,
        threads: {
            url: string,
            name: string,
            type: ChannelType,
            id: string
        }[] | null,
        type: ChannelType,
        id: string
    }> = {};
    for (const channel of [...(await message.guild!.channels.fetch()).values()]) {
        if (!channel) continue;
        let threads: any[] | null = [];
        if ("threads" in channel!) {
            for (const thread of [...(await channel.threads.fetch()).threads.values()]) {
                threads.push({
                    url: thread.url,
                    name: thread.name,
                    type: thread.type,
                    id: thread.id
                });
            }
        } else {
            threads = null;
        }
        channels[channel.id] = {
            parentId: channel?.parentId,
            parentName: channel?.parent?.name,
            nsfw: "nsfw" in channel ? channel?.nsfw : null,
            position: channel.position,
            rawPosition: channel.rawPosition,
            url: channel.url,
            topic: "topic" in channel ? channel.topic : null,
            name: channel.name,
            threads,
            type: channel.type,
            id: channel.id
        }
    }
    message.reply("Stringifying messages...")
    const messagesLength = guildMessages.length
    guildMessages = [];
    files["options.json"] = JSON.stringify({"multichannel": true})
    files["messages.json"] = JSON.stringify(parsedMessages)
    files["authors.json"] = JSON.stringify(authors)
    files["channels.json"] = JSON.stringify(channels)
    message.reply("Writing...")
    parsedMessages = [];
    authors = {};
    await mkdir("./output")
    for (const [name, data] of Object.entries(files)) {
        console.log(name)
        await Bun.write("./output/" + name, data)
    }
    message.reply("Finished!")
})

const archivalChunkedExtract = async (index: number, source: TextBasedChannel, destination: string, message: Message<boolean> | null, webhook?: Webhook, start?: string) => {
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
        "name": "Message Archive Chunked Extraction",
        "reason": "Extracting messages"
    })
    const destinationChannel = await client.channels.fetch(destination) as TextChannel
    const archiveMessages = messages.filter(message => message.content === "archive")
    const getAttachment = async (attachmentId: string) => Buffer.from(await (await fetch([...messages.find(message => message.content === attachmentId)?.attachments.values()!][0].url)).arrayBuffer())
    for (const archiveMessage of archiveMessages) {
        if (archiveMessage.attachments.size < 1) continue
        const zip = await JSZip.loadAsync(await (await fetch([...archiveMessage.attachments.values()][0].url)).arrayBuffer())
        if (!zip.file("messages.json") || !zip.file("authors.json")) continue
        const optionsFile = zip.file("authors.json")
        const options = optionsFile ? JSON.parse(await optionsFile.async("string")) : {"multichannel": false}
        const messages = JSON.parse(await zip.file("messages.json")!.async("string"))
        const authors = JSON.parse(await zip.file("authors.json")!.async("string"))
        let shouldSend = !start
        const latestMsg = (await destinationChannel.messages.fetch({ limit: 1 })).first()
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
                "type": "chunked_extract",
                "source": source.id,
                "destination": destination,
                "webhook": webhook?.id,
                "current": current.id
            }
            await (await archivalInfoMsg()).edit(JSON.stringify(archivalInfo))
            const files = []
            for (const attachment of current.attachments) {
                if (!zip.file(attachment.file)) continue;
                files.push({
                    "name": attachment.name,
                    "attachment": await getAttachment(attachment.id),
                    "description": attachment.description
                })
            }
            const authorName = authors[current.author].displayName.replace(/discord/ig, "D1scord")
            if (!current.content && current.embeds.length === 0 && files.length === 0) continue;
            await webhook!.send({
                "username": options.multichannel ? appendCappedSuffix(authorName, " - #" + current.channelName) : authorName,
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
    }
}

client.on(Events.MessageCreate, async message => {
    if (!message.content.startsWith("$chunked_extract") || message.author.bot) return
    const sourceId = message.content.split(" ")[1].match(/[0-9]+/)?.[0]
    if (!sourceId) return await message.reply("Invalid channel id")
    const source = await client.channels.fetch(sourceId)
    if (!source || !("guild" in source)) return void await message.reply("Source not found.")
    await source.guild.members.fetch(message.author)
    if (!source.permissionsFor(message.author)?.has(PermissionsBitField.Flags.ManageMessages)) message.reply("You need the Manage Messages permission in the source.")
    if (!(message.channel as GuildChannel).permissionsFor(message.author)?.has(PermissionsBitField.Flags.ManageMessages)) message.reply("You need the Manage Messages permission.")
    await archivalChunkedExtract(archivalInfo.push({}) - 1, source as TextBasedChannel, message.channel.id, message)
})

client.on(Events.MessageCreate, async message => {
    if (message.content !== "$abort" || message.author.bot) return
    await (await archivalInfoMsg()).edit(JSON.stringify([]))
    process.exit();
})


const archivalInfoMsg = async () => await ((await client.channels.fetch("1225939024481619988")) as TextChannel).messages.fetch("1225939476447100988")

interface TwoChannelTask {
    type: "copy" | "chunked_extract",
    source: string,
    destination: string,
    webhook: string,
    current: string
}
interface ExtractTask {
    type: "extract",
    message: string,
    channel: string,
    webhook: string,
    current: string
}
type Task = TwoChannelTask | ExtractTask
const archivalInfo: (Task | {} | null)[] = JSON.parse((await archivalInfoMsg()).content).filter((task: Task) => task)

for (const [index, task] of archivalInfo.entries()) {
  if (!task) continue
  if (!("type" in task)) continue
  if (task.type === "copy") {
    if (!await client.channels.fetch(task.source) || !await client.channels.fetch(task.destination)) continue
    try {
      archivalCopy(index, await client.channels.fetch(task.source) as TextBasedChannel, task.destination, null, (await (await client.channels.fetch(task.destination) as TextChannel).fetchWebhooks()).get(task.webhook), task.current)
    } catch (e) {
      console.error(e)
    }
  } else if (task.type === "chunked_extract") {
    if (!await client.channels.fetch(task.source) || !await client.channels.fetch(task.destination)) continue
    try {
      archivalChunkedExtract(index, await client.channels.fetch(task.source) as TextBasedChannel, task.destination, null, (await (await client.channels.fetch(task.destination) as TextChannel).fetchWebhooks()).get(task.webhook), task.current)
    } catch (e) {
      console.error(e)
    }
  } else if (task.type === "extract") {
    if (!await client.channels.fetch(task.channel)) continue
    archivalExtract(index, await (await client.channels.fetch(task.channel) as TextChannel).messages.fetch(task.message), (await (await client.channels.fetch(task.channel) as TextChannel).fetchWebhooks()).get(task.webhook), task.current)
  }
}