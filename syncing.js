import { Events, WebhookClient } from 'discord.js';
import JSONdb from 'simple-json-db';
import JSON5 from "json5"

import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from 'url';

import { dataContent, saveData } from "./dataMsg.js"

const dirname = path.dirname(fileURLToPath(import.meta.url));

import client from "./client.js"

const messageMap = new JSONdb("./map.json")


dataContent.lastHandledMessage = {};
await saveData()
const relayMessage = async (message) => {
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
  dataContent.lastHandledMessage[message.channel.id] = message.id;
  await saveData()
}
client.on(Events.MessageCreate, relayMessage)

const webhookData = JSON5.parse(await fs.readFile(dirname + "/webhooks.json"))
for (const group of webhookData) {
  for (const webhookData of group) {
    if (dataContent.lastHandledMessage[webhookData.channel]) {
      console.log("LHM found for " + webhookData.name)
      try {
        const channel = await client.channels.fetch(webhookData.channel)
        if (dataContent.lastHandledMessage[webhookData.channel] && await client.messages.fetch(dataContent.lastHandledMessage[webhookData.channel])) continue
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