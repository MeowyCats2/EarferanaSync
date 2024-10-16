import { Events, WebhookClient, Message } from 'discord.js';
import JSONdb from 'simple-json-db';
import JSON5 from "json5"

import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from 'url';

import { dataContent, saveData } from "./dataMsg.js"

const dirname = path.dirname(fileURLToPath(import.meta.url));

import client from "./client.js"

const messageMap = new JSONdb("./map.json")

await saveData()
export const relayMessage = async (message) => {
  if (message.flags.any(16384)) {
    console.log("Forwarded message found!")
    const rawMessage = (await client.rest.get("/channels/" + message.channel.id + "/messages/" + message.id)).message_snapshots[0].message
    return await relayMessage(new Message(client, {
      ...rawMessage,
      "channel_id": message.channel.id,
      "guild_id": message.guild.id,
      "id": message.reference.messageId,
      "author": await client.rest.get("/users/" + message.author.id),
      "embeds": [...rawMessage.embeds, {
        "type": "rich",
        "title": "Forwarded message",
        "description": "This message was originally a forwarded message.",
        "author": {
          "name": "Jump to original message",
          "url": "https://discord.com/channels/" + (message.reference.guildId ?? "@me") + "/" + message.reference.channelId + "/" + message.reference.messageId
        },
        "footer": {
          "text": message.content
        }
      }]
    }))
  }
  let dataToSend = {
    "content": message.content,
    "embeds": message.embeds,
    "allowedMentions": {
      "parse": [],
      "users": [],
      "roles": []
    },
    "files": [...message.attachments.values(), ...message.stickers.mapValues(sticker => sticker.url).values()],
    "avatarURL": message.author.avatarURL()
  }
  console.log(JSON.stringify(message))
  if (message.content === "" && message.attachments.size === 0 && message.embeds.length === 0 && message.stickers.size === 0 && !message.poll) return
  if (message.poll) {
    console.log("Poll")
    dataToSend.embeds.push({
      "title": "Poll",
      "author": {
        "name": message.poll.question.text
      },
      "description": [...message.poll.answers.values()].map(answer => (answer.emoji ? answer.emoji + " " : "") + answer.text).join("\n"),
      "footer": {
        "text": message.poll.allowMultiselect ? "Multiple choice" : "Single choice"
      },
      "timestamp": message.poll.expiresAt.toISOString()
    })
    console.log(dataToSend)
  }
  if (message.type === 46) {
    const pollMessage = await message.channel.messages.fetch(message.reference.messageId)
    dataToSend.embeds.push({
      "title": "Poll",
      "author": {
        "name": pollMessage.poll.question.text
      },
      "fields": [...pollMessage.poll.answers.values()].map(answer => ({
        "name": (answer.emoji ? answer.emoji + " " : "") + answer.text,
        "value": answer.voteCount
      })),
      "footer": {
        "text": pollMessage.poll.allowMultiselect ? "Multiple choice" : "Single choice"
      },
      "timestamp": pollMessage.poll.expiresAt.toISOString()
    })
  }
  console.log(dataToSend)
  for (const [id, group] of Object.entries(dataContent.linkedGroups)) {
    const current = group.find(webhook => webhook.channel === message.channel.id)
    if (!current) continue
    if (message.webhookId === current.webhook.split("/")[5]) return
    const currMap = {}
    console.log(group)
    for (const channelData of group) {
      if (channelData.channel === current.channel) continue
      const webhookClient = new WebhookClient({ url: channelData.webhook });
      currMap[channelData.channel] = (await webhookClient.send({...dataToSend, "username": (message.author.displayName ?? "Unknown User") + " - " + current.name})).id
    }
    currMap.group = id
    messageMap.set(message.id, currMap)
  }
  dataContent.lastHandledMessage[message.channel.id] = message.id;
  await saveData()
}
client.on(Events.MessageCreate, relayMessage)

for (const group of Object.values(dataContent.linkedGroups)) {
  for (const webhookData of group) {
    if (dataContent.lastHandledMessage[webhookData.channel]) {
      console.log("LHM found for " + webhookData.name)
      try {
        const channel = await client.channels.fetch(webhookData.channel)
        if (dataContent.lastHandledMessage[webhookData.channel] && await channel.messages.fetch(dataContent.lastHandledMessage[webhookData.channel])) continue
        let messages = [...(await channel.messages.fetch({limit: 50, after: dataContent.lastHandledMessage[webhookData.channel]})).sort((a, b) => b.createdAt - a.createdAt).values()].reverse()
        if (messages.length === 0) continue
        console.log("Message found!")
        while (1) {
          const fetched = [...(await channel.messages.fetch({limit: 50, after: messages.at(-1).id})).sort((a, b) => b.createdAt - a.createdAt).values()].reverse()
          if (fetched.length === 0) break
          messages.push(...fetched)
        }
        console.log("Relaying messages...")
        for (const message of messages) {
          await relayMessage(message);
        }
      } catch (e) {
        console.error(e)
      }
    }
  }
}

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (newMessage.content === "" && newMessage.attachments.size === 0 && newMessage.stickers.size === 0) return
  const cached = messageMap.get(newMessage.id)
  if (!cached) return
  console.log(cached)
  const group = dataContent.linkedGroups[cached.group]
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
  const group = dataContent.linkedGroups[cached.group]
  for (const channelData of group) {
    const messageID = cached[channelData.channel]
    if (!messageID) continue;
    const webhookClient = new WebhookClient({ url: channelData.webhook });
    await webhookClient.deleteMessage(messageID)
  }
})