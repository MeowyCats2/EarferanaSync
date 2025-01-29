// Require the necessary discord.js classes
import { Events, UserFlags, AuditLogEvent, PermissionsBitField, Routes, SlashCommandBuilder, SlashCommandBooleanOption, SlashCommandStringOption, GuildChannel, SlashCommandIntegerOption, ComponentType, ButtonStyle, TextInputStyle, SlashCommandChannelOption, DiscordAPIError, MessageFlags, ChannelType, WebhookClient } from 'discord.js';
import type { Guild, User, TextChannel, Webhook } from "discord.js"
import { scrapePosts } from './scrapeyt.ts';
import type { Post } from "./scrapeyt.ts"

import JSONdb from 'simple-json-db';
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from 'url';
import { saveData, dataContent } from "./dataMsg.ts"

import express from 'express';
const app = express(); 

app.get('/*?', (req, res) => {
  res.send('online')
})

app.listen(3000, () => { // Listen on port 3000
    console.log('Listening!') // Log when listen success
})

import "./archival.ts"
//import "./syncing.ts"

const dirname = path.dirname(fileURLToPath(import.meta.url));

const db = new JSONdb('./exeInfo.json');

import client from "./client.ts"
client.setMaxListeners(0);

const whitelist = await fs.readFile(dirname + "/whitelist.json")

client.on(Events.GuildMemberAdd, async member => {
  if (member.guild.id !== "1216816878937313442") return;
  if (member.user.bot && !member.user.flags?.has(UserFlags.VerifiedBot) && !whitelist.includes(member.id.toString())) {
    member.kick("Not verified")
  }
})

  const handleKick = async (guild: Guild, executor: User) => {
    if (executor.id === "1097331115217403924") {
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
  if (member.guild.id !== "1216816878937313442") return;
    const fetchedLogs = await member.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberKick,
    });

    const kickLog = fetchedLogs.entries.first();

    if (!kickLog) return 

    const { executor, target } = kickLog;

	if (!executor) return;

    if (kickLog.createdAt < (member.joinedAt ?? 0)) { 
        return
    }

    // And now we can update our output with a bit more information
    // We will also run a check to make sure the log we got was for the same kicked member
    if (target?.id === member.id) {
      await handleKick(member.guild, executor)
    } else {
        return
    }
});


client.on(Events.GuildBanAdd, async (ban) => {
  if (ban.guild.id !== "1216816878937313442") return;
    const fetchedLogs = await ban.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberBanAdd,
    });

    const banLog = fetchedLogs.entries.first();

    if (!banLog) return 

  const { executor, target } = banLog;

  if (!executor) return;

  await handleKick(ban.guild, executor)

})

//const rest = new REST().setToken(process.env.token);
//console.log(JSON.stringify((await client.rest.get("/channels/1001902549248512221/messages/1227396718216351756")).poll, null, 4))
//console.log((await (await client.channels.fetch("1001902549248512221")).messages.fetch("1227396718216351756")).poll)

client.on(Events.MessageCreate, async message => {
  if (!message.content.startsWith("$rename") || message.author.bot) return
  if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageChannels)) return void message.reply("You need the Manage Channels permission.")
  const options = message.content.replace(/^\$rename\s/, "").split(" ")
  const channelId = options[0].match(/[0-9]+/)?.[0]
  const channelName = options[1]
  if (!channelId) return void message.reply("Please provide a channel ID.")
  const channel = await client.channels.fetch(channelId)
  if (!(channel instanceof GuildChannel)) return void await message.reply("Not a guild channel!")
  await (channel as GuildChannel).edit({"name": channelName})
  await message.reply("Name edited!")
})
client.on(Events.MessageCreate, async message => {
  if (!message.content.startsWith("$topic") || message.author.bot) return
  if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageChannels)) return void message.reply("You need the Manage Channels permission.")
  const options = message.content.replace(/^\$topic\s/, "").split(" ")
  const channelId = options[0].match(/[0-9]+/)?.[0]
  if (!channelId) return void message.reply("Please provide a channel ID.")
  if (!options[1]) return await message.reply({
	content: "Would you like to open up a modal?",
	components: [
		{
			"type": ComponentType.ActionRow,
			"components": [
				{
					"type": ComponentType.Button,
					"label": "Edit Topic",
					"style": ButtonStyle.Primary,
					"customId": "rename." + channelId
				}
			]
		}
	]
  })
  const channelTopic = options[1].replaceAll("\\>", ">")
  const channel = await client.channels.fetch(channelId)
  if (!(channel instanceof GuildChannel)) return void await message.reply("Not a guild channel!")
  if (channel.guildId !== message.guildId) return await message.reply("Wrong guild!")
  await (channel as GuildChannel).edit({"topic": channelTopic})
  await message.reply("Topic edited!")
})
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
	if (interaction.commandName !== "change_topic") return;
	const channelInput = interaction.options.getChannel("channel")
	const channel = channelInput ?? interaction.channel
	if (!channel) return await interaction.reply("Where are you running this right now? In space?")
	if (!("topic" in channel)) return await interaction.reply("That can't have a topic, silly.")
	await interaction.showModal({
		"customId": "rename." + channel.id,
		"title": channelInput ? "Channel Topic" : "Channel Topic (editing current channel)",
		"components": [
			{
				"type": ComponentType.ActionRow,
				"components": [
					{
						"type": ComponentType.TextInput,
						"customId": "topic",
						"label": "Topic",
						"style": TextInputStyle.Paragraph,
						"value": channel.topic ?? "",
						"maxLength": channel.type === ChannelType.GuildForum ? 4000 : 1024
					}
				]
			}
		]
	})
})
client.on(Events.InteractionCreate, async interaction => {
	if ((!interaction.isButton() && !interaction.isModalSubmit()) || !interaction.customId.startsWith("rename.")) return;
	if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels)) return await interaction.reply("You need the Manage Channels permission.")
	const channelId = interaction.customId.split(".")[1]
	const channel = await client.channels.fetch(channelId)
	if (!(channel instanceof GuildChannel)) return void await interaction.reply("Not a guild channel!")
	if (channel.guildId !== interaction.guildId) return await interaction.reply("Wrong guild!")
	if (!("topic" in channel)) return await interaction.reply("That can't have a topic, silly.")
	if (interaction.isButton()) {
		await interaction.showModal({
			"customId": interaction.customId,
			"title": "Channel Topic",
			"components": [
				{
					"type": ComponentType.ActionRow,
					"components": [
						{
							"type": ComponentType.TextInput,
							"customId": "topic",
							"label": "Topic",
							"style": TextInputStyle.Paragraph,
							"value": channel.topic ?? ""
						}
					]
				}
			]
		})
	}
	if (interaction.isModalSubmit()) {
		const topic = interaction.fields.getTextInputValue("topic")
		try {
			await (channel as GuildChannel).edit({"topic": topic})
			await interaction.reply({
				content: "Topic edited!",
				flags: MessageFlags.Ephemeral
			})
		} catch (e) {
			if (e instanceof DiscordAPIError) {
				let additional = "";
				if (e.code === 50035) additional = "\n\nThis error means that you either put a disallowed word in the topic, or an emoji that the bot isn't in. To use this topic, you must first remove those or invite the bot to the servers the emojis are in."
				return await interaction.reply({
					content: "An error occured while trying to edit the topic.\n\n" + e.code + ": " + e.message + additional,
					flags: MessageFlags.Ephemeral
				})
			} else {
				throw e;
			}
		}
	}
})
client.on(Events.MessageCreate, async message => {
  if (!message.content.startsWith("$poll") || message.author.bot) return
  if (!("permissionsFor" in message.channel)) return void await message.reply("You cannot perform this in a DM channel.")
  if (!message.channel.permissionsFor(message.author)?.has(PermissionsBitField.Flags.ManageMessages)) return void message.reply("You need the Manage Messages permission.")
  const options = message.content.replace(/^\$poll\s/, "").split("|")
  if (options.length < 2) return void message.reply("Not enough command options.")
  try {
    await client.rest.post("/channels/" + message.channel.id + "/messages" as `/${string}`, {
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
	  if (typeof e === "object" && e && "message" in e && e.message === "string") message.reply(e.message)
  }
});

interface PerpetualIncidentActions {
	guildId: string,
	disable_invites: boolean,
	disable_dms: boolean
}

const performIncidentActions = async () => {
	const tommorow = new Date();
tommorow.setDate((new Date()).getDate() + 1)
	for (const guild of dataContent.perpetualIncidentActions) {
		console.log(await client.rest.put("/guilds/" + guild.guildId + "/incident-actions" as `/${string}`, {
			"body": {"invites_disabled_until": guild.disable_invites ? tommorow.toISOString() : null, "dms_disabled_until": guild.disable_dms ? tommorow.toISOString() : null}
		}))
	}
};
if (Math.abs(dataContent.lastRun - Date.now()) / 36e5 >= 12) await performIncidentActions();
setInterval(performIncidentActions, 60 * 60 * 12 * 1000);

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
	if (interaction.commandName !== "perpetual_incident_actions") return;
	await interaction.deferReply();
	const existing = dataContent.perpetualIncidentActions.find((guild: PerpetualIncidentActions) => guild.guildId === interaction.guildId)
	const guildData = {
		"guildId": interaction.guildId,
		"disable_invites": interaction.options.get("disable_invites")?.value ?? existing?.disable_invites ?? false,
		"disable_dms": interaction.options.get("disable_dms")?.value ?? existing?.disable_dms ?? false
	}
	if (existing) {
	const index = dataContent.perpetualIncidentActions.findIndex((guild: PerpetualIncidentActions) => guild.guildId === interaction.guildId)
	if (guildData.disable_invites || guildData.disable_dms) {
		dataContent.perpetualIncidentActions[index] = guildData;
		} else {
		dataContent.perpetualIncidentActions.splice(index, 1)
		}
	} else if (guildData.disable_invites || guildData.disable_dms) dataContent.perpetualIncidentActions.push(guildData)
	await saveData()
	await interaction.followUp("Configured.")
})

const handleYTPost = async (post: Post, webhook: Webhook | WebhookClient, subtext: string | null) => {
	console.log(post.postId);
	const multiImage = [];
	if (post.attachment.multiImage) {
		for (const image of post.attachment.multiImage) {
			multiImage.push({
				attachment: Buffer.from(await (await fetch(image.at(-1)!.url)).arrayBuffer()),
				name: post.postId + ".png"
			})
		}
	}
	const embed = post.attachment.poll ? [
		{
			title: "Poll",
			description: post.attachment.poll.choices.join("\n"),
			footer: {
				text: post.attachment.poll.pollType + " \u2022 " + post.attachment.poll.totalVotes
			}
		}
	] : (post.attachment.video ? [
		{
			title: post.attachment.video.title,
			description: post.attachment.video.descriptionSnippet,
			author: post.attachment.video.owner.name ? {
				name: post.attachment.video.owner.name,
				icon_url: post.attachment.video.owner.thumbnails?.at(-1)?.url,
				url: "https://youtube.com" + post.attachment.video.owner.url
			} : undefined,
			footer: post.attachment.video.publishedTimeText ? {
				text: post.attachment.video.lengthText.long + " \u2022 " + post.attachment.video.viewCountText + " \u2022 " + post.attachment.video.publishedTimeText
			} : undefined,
			url: post.attachment.video.videoId ? "https://www.youtube.com/watch?v=" + post.attachment.video.videoId : undefined
		}
	] : (post.attachment.quiz ? [
		{
			title: "Quiz",
			fields: post.attachment.quiz.choices.map(choice => ({
				name: (choice.isCorrect ? "\u2705" : "\u274C") + " " + choice.text,
				value: choice.explanation
			})),
			footer: {
				text: post.attachment.quiz.quizType + " \u2022 " + post.attachment.quiz.totalVotes + " \u2022 " + (post.attachment.quiz.disableChangingQuizAnswer ? "Changing quiz answer disabled" : "Changing quiz answer enabled") + " \u2022 " + (post.attachment.quiz.enableAnimation ? "Animated" : "Not animated")
			}
		}
	] : []))
	const parsePostContent = (postContent: {
		text: string,
		url?: string,
		webPageType?: string
	}[]) => postContent.map(content => content.url ? (content.url === content.text ? content.url : `[${content.text}](https://youtube.com${content.url})`) : content.text).join("")
	let contents = "";
	if (post.content) {
		for (const content of post.content) {
			const toAdd = content.url ? (content.url === content.text ? content.url : `[${content.text}](https://youtube.com${content.url})`) : content.text;
			if (toAdd.length + (subtext?.length ?? 0) > 1990) {
				let lasti = 0;
				for (let i = 0; i < toAdd.length - 1001; i += 1000) {
					await webhook.send({
						content: toAdd.slice(i, i + 1000),
						username: post.author.name,
						avatarURL: "https:" + post.author.thumbnails.at(-1)?.url,
					})
					lasti = i;
				}
				contents = toAdd.slice(lasti + 1000, lasti + 2000)
			} else if (contents.length + toAdd.length + (subtext?.length ?? 0) > 1990) {
				await webhook.send({
					content: contents,
					username: post.author.name,
					avatarURL: "https:" + post.author.thumbnails.at(-1)?.url,
				})
				contents = "";
			};
			if (toAdd.length + (subtext?.length ?? 0) <= 1990) contents += toAdd;
		}
	}
	await webhook.send({
		content: contents + (subtext ? "\n-# " + subtext : ""),
		files: post.attachment.image ? [
			{
				attachment: Buffer.from(await (await fetch(post.attachment.image.at(-1)!.url)).arrayBuffer()),
				name: post.postId + ".png"
			}
		] : multiImage,
		embeds: post.sharedPost ? [...embed, {
			title: "Shared Post",
			description: parsePostContent(post.sharedPost.content).slice(0, 4096),
			author: {
				icon_url: "https:" + post.sharedPost.author.thumbnails.at(-1)!.url,
				name: post.sharedPost.author.name,
				url: "https://youtube.com" + post.sharedPost.author.url
			},
			image: post.sharedPost.attachment.image ? {
				url: post.sharedPost.attachment.image.at(-1)!.url
			} : (post.sharedPost.attachment.multiImage ? {
				url: post.sharedPost.attachment.multiImage[0].at(-1)!.url
			} : undefined),
			fields: post.sharedPost.attachment.multiImage ? [
				{
					name: "Images",
					value: post.sharedPost.attachment.multiImage.map(image => image.at(-1)!.url).join("\n\n")
				}
			] : undefined,
			url: "https://www.youtube.com/post/" + post.sharedPost.postId
		}] : embed,
		username: post.author.name,
		avatarURL: "https:" + post.author.thumbnails.at(-1)?.url,
		components: [
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.Button,
						style: ButtonStyle.Link,
						url: "https://www.youtube.com/post/" + post.postId,
						label: "Original Post"
					}
				]
			}
		]
	})
}
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
	if (interaction.commandName !== "create_yt_community_relay") return;
	await interaction.deferReply({
		flags: MessageFlags.Ephemeral
	});
	if (!interaction.options.getString("channel_id") && !interaction.options.getString("username")) {
		return await interaction.followUp("Please provide either the channel ID or the username.")
	}
	if (interaction.options.getString("channel_id") && interaction.options.getString("username")) {
		return await interaction.followUp("Do not provide both the channel ID and the username.")
	}
	let channelId: string | null = null;
	if (interaction.options.getString("username")) {
		try {
			channelId = (await (await fetch("https://www.youtube.com/@" + interaction.options.getString("username"))).text()).match(/<link rel="canonical" href="https:\/\/www.youtube.com\/channel\/(.+?)">/)![1]
		} catch (e) {
			return await interaction.followUp("Failed to fetch channel ID. Is the username correct?")
		}
	} else {
		channelId = interaction.options.getString("channel_id")!;
	}
	let posts = null;
	try {
		posts = await scrapePosts(channelId);
	} catch (e) {
		console.error(e);
		return await interaction.followUp("Failed to fetch community posts. Are you sure the channel ID is correct? Please note that a channel ID is different than a username.")
	}
	const webhook = await (interaction.channel as TextChannel).createWebhook({
		"name": "YT Community Relaying",
		"reason": "Relay YT community posts"
	});
	posts.reverse();
	await interaction.followUp("Starting...")
	const subtext = interaction.options.getString("subtext");
	for (const post of posts) {
		await handleYTPost(post, webhook, subtext);
	}
	dataContent.ytCommunityRelays.push({
		postId: posts.at(-1)!.postId,
		channel: channelId,
		subtext,
		webhookUrl: webhook.url,
		webhookChannel: interaction.channelId
	})
	await saveData();
	await interaction.followUp({
		content: "Finished!",
		flags: MessageFlags.Ephemeral
	})
})
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
	if (interaction.commandName !== "list_yt_community_relays") return;
	await interaction.deferReply();
	const result = [];
	for (const relay of dataContent.ytCommunityRelays) {
		if ((await client.channels.fetch(relay.webhookChannel) as TextChannel)?.guildId === interaction.guildId) result.push(relay);
	}
	await interaction.followUp(result.map(relay => `<#${relay.webhookChannel}>`).join("\n"))
});
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
	if (interaction.commandName !== "remove_yt_community_relay") return;
	await interaction.deferReply();
	dataContent.ytCommunityRelays.splice(dataContent.ytCommunityRelays.findIndex((relay: any) => relay.webhookChannel === interaction.channelId), 1);
	await saveData();
	await interaction.followUp("Removed.")
});
const fetchNewPosts = async () => {
	for (const relay of dataContent.ytCommunityRelays) {
		const firstPage = await scrapePosts(relay.channel, true);
		const posts: Post[] = [];
		for (const post of firstPage) {
			if (post.postId === relay.postId) break;
			posts.push(post);
		}
		if (posts.length === 0) continue;
		const webhook = new WebhookClient({ url: relay.webhookUrl });
		for (const post of posts.toReversed()) {
			await handleYTPost(post, webhook, relay.subtext);
		};
		relay.postId = posts[0].postId;
		await saveData();
	}
}
fetchNewPosts();
setInterval(fetchNewPosts, 5 * 60 * 1000)
console.log(dataContent.ytCommunityRelays)
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
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
	new SlashCommandBuilder()
	.setName("create_group")
	.setDescription("Create a linked group.")
	.addStringOption(
		new SlashCommandStringOption()
		.setName("id")
		.setDescription("ID of the group to create.")
    .setRequired(true)
	)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageWebhooks),
	new SlashCommandBuilder()
	.setName("link_channel")
	.setDescription("Add the channel to a linked group.")
	.addStringOption(
		new SlashCommandStringOption()
		.setName("group_id")
		.setDescription("ID of the group to add to.")
    .setRequired(true)
  )
  .addStringOption(
		new SlashCommandStringOption()
		.setName("name")
		.setDescription("Name to be appended to member names when relaying.")
	)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageWebhooks),
	new SlashCommandBuilder()
	.setName("unlink_channel")
	.setDescription("Removes the channel from a linked group.")
  .addStringOption(
		new SlashCommandStringOption()
		.setName("channel")
		.setDescription("Channel (id) to be removed.")
	)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageWebhooks),
	new SlashCommandBuilder()
	.setName("linked_channels")
	.setDescription("Lists the channels in the group.")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageWebhooks),
	new SlashCommandBuilder()
	.setName("delete_group")
	.setDescription("Deletes a linked group. Group has to be empty.")
	.addStringOption(
		new SlashCommandStringOption()
		.setName("id")
		.setDescription("ID of the group to create.")
    .setRequired(true)
	),
	new SlashCommandBuilder()
	.setName("archive_link")
	.setDescription("Archive the channel and creates a linked group. (run on destination)")
	.addStringOption(
		new SlashCommandStringOption()
		.setName("group_id")
		.setDescription("ID of the group to create.")
    .setRequired(true)
  )
  .addStringOption(
		new SlashCommandStringOption()
		.setName("source_channel")
		.setDescription("Channel (id) to be sourced from.")
	)
  .addStringOption(
		new SlashCommandStringOption()
		.setName("source_name")
		.setDescription("Name to be appended to member names when relaying.")
	)
  .addStringOption(
		new SlashCommandStringOption()
		.setName("destination_name")
		.setDescription("Name to be appended to member names when relaying.")
	)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageWebhooks),
	new SlashCommandBuilder()
	.setName("server_save")
	.setDescription("Puts all the messages from a server toa channel. (run on destination)")
	.addStringOption(
		new SlashCommandStringOption()
		.setName("save_id")
		.setDescription("ID of the group to create.")
		.setRequired(true)
	)
	.addIntegerOption(
		new SlashCommandIntegerOption()
		.setName("additional_webhooks")
		.setDescription("Number of additional webhooks to create.")
		.setMaxValue(9)
	)
  .addStringOption(
		new SlashCommandStringOption()
		.setName("source_guild")
		.setDescription("Server (id) to be sourced from.")
	)
  .addStringOption(
		new SlashCommandStringOption()
		.setName("source_name")
		.setDescription("Name to be appended to member names when relaying.")
	)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageWebhooks),
	new SlashCommandBuilder()
	.setName("delete_server_save")
	.setDescription("Deletes all server saves in channel.")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageWebhooks),
  new SlashCommandBuilder()
  .setName("change_topic")
  .setDescription("Change the topic of a channel.")
  .addChannelOption(
	  new SlashCommandChannelOption()
	  .setName("channel")
	  .setDescription("The channel to change.")
  )
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels),
  new SlashCommandBuilder()
  .setName("clear_channel_group_queue")
  .setDescription("Clears the message queue for the current channel group.")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageWebhooks),
  new SlashCommandBuilder()
  .setName("create_yt_community_relay")
  .setDescription("Create a relay from a YouTube community post tab")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageWebhooks)
  .addStringOption(
	  new SlashCommandStringOption()
	  .setName("channel_id")
	  .setDescription("Channel ID - not the username!")
  )
  .addStringOption(
	  new SlashCommandStringOption()
	  .setName("username")
	  .setDescription("Username of the channel")
  )
  .addStringOption(
	  new SlashCommandStringOption()
	  .setName("subtext")
	  .setDescription("Place here pings and stuff")
  ),
  new SlashCommandBuilder()
  .setName("list_yt_community_relays")
  .setDescription("Lists the YT community relays of the server")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageWebhooks),
  new SlashCommandBuilder()
  .setName("remove_yt_community_relay")
  .setDescription("Remove the YT community relays for the current channel")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageWebhooks)
]
if (!client.application) throw new Error("No application for client?")
await client.rest.put(Routes.applicationCommands(client.application.id), {"body": commands})

dataContent.lastRun = (new Date()).toISOString();
await saveData()
console.log("Running!")