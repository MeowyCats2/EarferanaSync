import discord
import asyncio
import os
from discord.ext import commands
#from wsgi import start
import aiohttp
import datetime
import sys
from forgive import ForgiveDB
from subprocess import Popen
Popen(["node", "."], stdout=sys.stdout, stderr=sys.stderr)
import requests
import traceback

from flask import Flask, send_file
from threading import Thread

app = Flask('n')

def run():
  try:
    app.run(host="0.0.0.0", port=2347)
  except Exception as exception:
    print(exception)
    if "Temporary failure in name resolution" in str(exception) or "Server disconnected" in str(exception):
      os.system("kill 1")

def startSite():
  t = Thread(target=run)
  t.start()

@app.route("/")
def home():
  return "hello"


@app.route("/MeowFont.otf")
def font():
  return send_file('./MeowFont.otf', download_name='MeowFont.otf')

@app.route("/MFGoman.otf")
def goman():
  return send_file('./MFGoman.otf', download_name='MFGoman.otf')
  
@app.route("/MFCorodenian.otf")
def corodenian():
  return send_file('./MFCorodenian.otf', download_name='MFCorodenian.otf')

@app.route("/MFTaurian.otf")
def taurian():
  return send_file('./MFTaurian.otf', download_name='MFTaurian.otf')
  
startSite()

bot = commands.Bot(command_prefix="rp!archive!",intents=discord.Intents().all())
token = os.environ['token']

devs = [719785204285308931, 862046044862021682, 880433376148979732]

@bot.command()
async def createwebhook(ctx):
  webhook = await ctx.channel.create_webhook(name="mywebhook")
  await ctx.send(webhook.url)

@bot.command()
async def start(ctx):
  if ctx.author.id in devs:
        #webhook = discord.Webhook.from_url('https://discord.com/api/webhooks/957062490087366676/dMQ5HBPRJAHZTIoMlRJXMLgq-OoVKFAoROWrDEZfR3fl7jFe8tcIe6YDVutP5i7W698n', adapter=discord.AsyncWebhookAdapter(session))
        #webhook = discord.Webhook.from_url('https://discord.com/api/webhooks/960268009497321635/Mk-RiXis4U4fP9sYK4nnBwzHR_h8BnlFYTEfwr0J_rQdJtcnfEZ0Om5ByXNe4z2mQJf-', adapter=discord.AsyncWebhookAdapter(session))
        webhook = discord.SyncWebhook.from_url(
            'https://discord.com/api/webhooks/1089050726224900096/qAvXfn3oeagpEbw8drwK9A-5LW5kiXee87bwtzGaE7puwHaFvh_JSJkMAp8L2V8oRSO6',
#            adapter=discord.RequestsWebhookAdapter())
        )

        history = ctx.history(limit=None, oldest_first=True)

        async for message in history:
          try:
            await asyncio.sleep(20)
            files = []
            for attachment in message.attachments:
                files.append(await attachment.to_file())
            if message.content != "" or message.embeds != [] or files != []:
                if hasattr(message.author, 'avatar_url'):
                    webhook.send(
                        username=message.author.name,
                        avatar_url=message.author.avatar_url,
                        content=message.content,
                        files=files,
                        embeds=message.embeds,
                        allowed_mentions=discord.AllowedMentions.none())
                else:
                    webhook.send(
                        username=message.author.name,
                        content=message.content,
                        files=files,
                        embeds=message.embeds,
                        allowed_mentions=discord.AllowedMentions.none())
          except Exception as err:
            print(err)
            

@bot.command()
async def lol(ctx):
  if ctx.author.id in devs:
    #async with aiohttp.ClientSession() as session:
        #webhook = discord.Webhook.from_url('https://discord.com/api/webhooks/957062490087366676/dMQ5HBPRJAHZTIoMlRJXMLgq-OoVKFAoROWrDEZfR3fl7jFe8tcIe6YDVutP5i7W698n', adapter=discord.AsyncWebhookAdapter(session))
        #webhook = discord.Webhook.from_url('https://discord.com/api/webhooks/960268009497321635/Mk-RiXis4U4fP9sYK4nnBwzHR_h8BnlFYTEfwr0J_rQdJtcnfEZ0Om5ByXNe4z2mQJf-', adapter=discord.AsyncWebhookAdapter(session))
        webhook = discord.SyncWebhook.from_url(
            'https://discord.com/api/webhooks/1025525868635881492/q9xomWLUHcYhcHp1d2gRIzybVR0eBdnxCCnGE4a2v8SBjr4Cs5IprnLy3K7tOrI_qOsw' #NO GO DOWN TO THE SERVi didn't do anything dwERS VARIABLE
          # THIS CODE IS OUTDATED NEW CODE BELOW SERVERS VARIABL
        )
#            adapter=discord.RequestsWebhookAdapter(session)) #AsyncWebhookAdapter

        history = ctx.history(limit=None, oldest_first=True)

        async for message in history:
            await asyncio.sleep(1)
            files = []
            for attachment in message.attachments:
                files.append(await attachment.to_file())
            if message.content != "" or message.embeds != [] or files != []:
                if hasattr(message.author, 'avatar') and hasattr(message.author.avatar, "url"):
                    webhook.send(
                        username=message.author.name,
                        avatar_url=message.author.avatar.url,
                        content=message.content,
                        files=files,
                        embeds=message.embeds,
                        allowed_mentions=discord.AllowedMentions.all())
                else:
                    webhook.send(
                        username=message.author.name,
                        content=message.content,
                        files=files,
                        embeds=message.embeds,
                        allowed_mentions=discord.AllowedMentions.all())

@bot.command()
async def get_pfps(ctx):
    async with aiohttp.ClientSession() as session:

        obj = {}

        history = ctx.history(limit=None, oldest_first=True)

        async for message in history:
            obj[message.author.name] = message.author.avatar_url
        print(str(obj))
        text_file = open("result.txt", "w")
        text_file.write(str(obj))
        text_file.close()
        await ctx.send(file=discord.File('result.txt'))
        await ctx.send("Done!")


@bot.command()
async def get_msgs(ctx):
    async with aiohttp.ClientSession() as session:

        list = []

        history = ctx.history(limit=None, oldest_first=True)

        async for message in history:
            obj = {
                "tts": message.tts,
                "type": str(message.type),
                "author": {
                    "joined_at":
                    datetime.datetime.timestamp(
                        getattr(message.author, "joined_at",
                                datetime.datetime.fromtimestamp(0))),
                    "guild":
                    getattr(message.author, "guild", None),
                    "nick":
                    getattr(message.author, "nick", None),
                    "colour":
                    str(message.author.colour),
                    "color":
                    str(message.author.color),
                    "mention":
                    message.author.mention,
                    "display_name":
                    message.author.display_name,
                    "avatar":
                    str(getattr(message.author, "avatar", None)),
                    "avatar_url":
                    getattr(message.author, "avatar_url", None),
                    "bot":
                    message.author.bot,
                    "default_avatar":
                    str(message.author.default_avatar),
                    "default_avatar_url":
                    message.author.default_avatar_url,
                    "discriminator":
                    message.author.discriminator,
                    "id":
                    message.author.id,
                    "name":
                    message.author.name
                },
                "content": message.content,
                "embeds": [],
                "channel": message.channel.id,
                "mention_everyone": message.mention_everyone,
                "mentions": [ping.id for ping in message.mentions],
                "channel_mentions":
                [ping.id for ping in message.channel_mentions],
                "role_mentions": [ping.id for ping in message.role_mentions],
                "id": message.id,
                "webhook_id": message.webhook_id,
                "attachments": [image.url for image in message.attachments],
                "pinned": message.pinned,
                "reactions": {
                    "emoji":
                    [emoji.emoji for emoji in message.reactions],
                    "count":
                    [emoji.count for emoji in message.reactions],
                    "custom_emoji":
                    [emoji.custom_emoji for emoji in message.reactions],
                    "activity":
                    message.activity,
                    "application":
                    message.application,
                    "stickers":
                    [sticker.image_url for sticker in message.stickers],
                    "guild":
                    message.guild.id,
                    "raw_mentions":
                    message.raw_mentions,
                    "raw_channel_mentions":
                    message.raw_channel_mentions,
                    "raw_role_mentions":
                    message.raw_role_mentions,
                    "clean_content":
                    message.clean_content,
                    "created_at":
                    datetime.datetime.timestamp(message.created_at),
                    "edited_at":
                    datetime.datetime.timestamp(message.edited_at),
                    "jump_url":
                    message.jump_url,
                    "system_content":
                    message.system_content
                }
            }

            if message.embeds != []:
                for embed in message.embeds:
                    embedinfo = {}
                    if embed.title:
                        embedinfo.title = embed.title
                    if embed.description:
                        embedinfo.description = embed.description
                    if embed.url:
                        embedinfo.url = embed.url
                    if embed.timestamp:
                        embedinfo.timestamp = datetime.datetime.timestamp(
                            embed.timestamp)
                    if embed.colour:
                        colourObj = None
                        if isinstance(embed.colour, int):
                            colourObj = discord.Colour(embed.colour)
                        else:
                            colourObj = embed.colour

                        embedinfo.leftBorder = str(colourObj)
                    if embed.author != embed.Empty:
                        if embed.author.name:
                            embedinfo.authorName = embed.author.name
                        if embed.author.url:
                            embedinfo.authorUrl = embed.author.url
                    if embed.footer != embed.Empty:
                        if embed.footer.text:
                            embedinfo.footerText = embed.footer.text

                    if embed.fields != embed.Empty and embed.fields != []:
                        embedinfo.fields = []
                        for field in embed.fields:
                            fieldinfo = {}
                            if field.inline:
                                fieldinfo.inline = True
                            if field.name:
                                fieldinfo.name = field.name
                            if field.value:
                                fieldinfo.value = field.value
                            embedinfo.fields.append(fieldInfo)
                        obj.embeds.append(embedInfo)

            list.append(obj)

            #list.append(message)
            #list.append(message)
        print(str(list))
        text_file = open("result.txt", "w")
        text_file.write(str(list))
        text_file.close()
        await ctx.send(file=discord.File('result.txt'))
        await ctx.send("Done!")


@bot.event
async def on_connect():
    print("Bot ready")

# Bodroum League
# https://discord.com/api/webhooks/1025174166288224327/dEi6qCx91GkWpStXJX3Wrz-TLzV6lkTrJDDvhuZ_imRgkF7mTm5DkJjP84yZUBRfDC90
# 991005001163894854

# Earferana Chronicles
# https://discord.com/api/webhooks/1025175411920994375/BHILc3Mp4VhlcQt5WPJFmIZVzh-GvK7t0_iOJQAneE24_iFDbjIOmc_qd3zpvgLfQzuM
# 1025175141417746482

# Pltfcl
# https://discord.com/api/webhooks/977742728404275231/IQhTUkVJ3j-sZbN9r5qpPJlMY6BVeqEiD0Ba6VLdz1qgkF5gO4xrhInV_Vc-KyNRQsMS
# 783923143986511895

# JMan
# https://discord.com/api/webhooks/1025178509922017340/Qkl6YtKuEA2H84tGu15-JH3q2GWnOOsTktbWRo7ToOWFp1aMtL1nzAbaeFf79GjUYoc-
# 1025178090038632558


#####################
###
# NEW CODE
###
#####################

servers = [
  # Universal Counting
  [
    {
      "name": "Mylo the Cat Server",
      "webhook": "https://discord.com/api/webhooks/1025219110356922448/Bq9tXzPSHMkzQmofkVsoGDOmUqtusxYx_56wDrkMmVTWYOHNUU1Zo78C0JTHhSMyMJsu",
      "wid": 1025219110356922448,
      "channel": 1025216458432708618
    },
    {
      "name": "Pltfcl. Official Server 1",
      "webhook": "https://discord.com/api/webhooks/1025222013058560000/SVZ9_jItnfOCRd__aKVICvc7ylKgTNB28rh8oJr-vX0hMaUD6iEEJJe4WOg06Sd4-P4_",
      "wid": 1025222013058560000,
      "channel": 1025221663660445798
    },
    {
      "name": "Mod Server",
      "webhook": "https://discord.com/api/webhooks/1025222887910670356/GqFbWUMPlfxALHwXm0GJRGjHEjd1fet9VxsLjN8veJ31FAU2gjltNlMbspzc16tltESb",
      "wid": 1025222887910670356,
      "channel": 1025222611459915786
    },
    {
      "name": "Mylo the cat backup",
      "webhook": "https://discord.com/api/webhooks/1074487042471366756/wsipKWfrX9sKKgDqMOrgJsxr39uol4oT-srsU2HYxt4RbLUrCC8o30q7MkYTDN-tdXZj",
      "wid": 1074487042471366756,
      "channel": 1032309953303678976
    }
  ],
  # tcc
  [
    {
      "name": "Earferana Chronicles",
      "webhook": "https://discord.com/api/webhooks/1099913624132259881/tQdfGssnpF04XraOaIybX6eGebLY9a8WP-wJA4lpi6vLN5rnJbd31tLYCrTLJB4Zs91M",
      "wid": 1099913624132259881,
      "channel": 1099913568285118505
    },
    {
      "name": "pltfcl. Official Server 1",
      "webhook": "https://discord.com/api/webhooks/1099914298748305449/AqS_evqG07vg8FjOZyUkPA5UZCmFcqHDyzDFVL3fHodNtr7VDlxBaeAiYdUZlpB59Pha",
      "wid": 1099914298748305449,
      "channel": 1099914236232216647
    },
    {
      "name": "The Mod Server",
      "webhook": "https://discord.com/api/webhooks/1099914599442161666/gZD_i2FlDpsrd8MYXDduF2KEEWcaaSsUJB0DBG85ciUjlQn7uEGaMahMwt5EOCAp3isn",
      "wid": 1099914599442161666,
      "channel": 1099914541262979142
    },
    {
      "name": "Starwalk Community",
      "webhook": "https://discord.com/api/webhooks/1099915080092614667/g1Y4uMQYPomsagBycATWc-IyasvyL-Npj4QcJiBsxHqexuygx6jUEzKmgEjYRCBzTGhp",
      "wid": 1099915080092614667,
      "channel": 1099914998488244234
    },
    {
      "name": "JMan's Server",
      "webhook": "https://discord.com/api/webhooks/1099916576679018496/ihfC33zzsCYbG__yWk3GLbbMBEeYy3n4u3y0rq41TJfEByCWvv2Bh0e00C03zsQ5XMW6",
      "wid": 1099916576679018496,
      "channel": 1099916484051996725
    }
  ],
  # mijovia lobby
  [
    {
      "name": "Mijovia",
      "webhook": "https://discord.com/api/webhooks/1224873167844278364/HgVe7DDrzts5p-XbBt1A2aPBOeGT1uMCmEBlVgSkEehVBJsJ5UoEOingWwDKPORkQUaP",
      "wid": 1224873167844278364,
      "channel": 1216817245259432057
    },
    {
      "name": "Earferana Chronicles",
      "webhook": "https://discord.com/api/webhooks/1224872389070946365/_WGeakiGEqYxALLDq6npk4NtB3plSPV5DEnQtxeYbSqPeXbyxNnqS1C_a686jlUqKXwb",
      "wid": 1224872389070946365,
      "channel": 1224872341172125728
    }
  ],
  # mijovia offtopic
  [
    {
      "name": "Mijovia",
      "webhook": "https://discord.com/api/webhooks/1224875371002990692/ONrAZ9Wgd61HipaUZCK9mv3rQ4bGYFg9KzsOe9JO9lkVaOjWM2ErgeAy1Z3IsvjIJqt4",
      "wid": 1224875371002990692,
      "channel": 1216817248107499621
    },
    {
      "name": "Earferana Chronicles",
      "webhook": "https://discord.com/api/webhooks/1224876873872310415/Pebxkw8x6mZrjBD3lCcpNF2iuU__00BlhfgsNXsNKp8KhPw7A1PDp4laWXAKNWBb4dsI",
      "wid": 1224876873872310415,
      "channel": 1224876819417796620
    }
  ],
  #debates
  [
    {
      "name": "Mijovia",
      "webhook": "https://discord.com/api/webhooks/1224876035833725038/ewq7HhSdve5iS6TFoIuMN2tNYRUQ0nRFPLf7KAmEb1_L3Kb9OiYVQREVCrXjT6vN4BrX",
      "wid": 1224876035833725038,
      "channel": 1216817249562787940
    },
    {
      "name": "Earferana Chronicles",
      "webhook": "https://discord.com/api/webhooks/1224877307525726219/b_WWyNQXibPCsByAZ7XEZRQafAtMYv4fB9CNlASlpZGl61INOxeKa_qKXgtLJ1UV3G6K",
      "wid": 1224877307525726219,
      "channel": 1224877250705362965
    }
  ]
]

from forgive import ForgiveDB

map_db = ForgiveDB('./map.json')

map = map_db.get("map")

def sendMwMsg(group, content, username, avatar):
  for server in group:
    webhook = discord.SyncWebhook.from_url(
      server["webhook"]
    )
    webhook.send(username=username,
        avatar_url=avatar,
        wait=True,
        content=content,
        files=[],
        embeds=[],
        allowed_mentions=discord.AllowedMentions(
            everyone=False,
            users=False,
            roles=False,
            replied_user=False))

async def sendMwMsgAsync(group, content, username, avatar):
  async with aiohttp.ClientSession() as session:
    for server in group:
      webhook = discord.Webhook.from_url(
          server["webhook"],
          session=session
        )
      await webhook.send(username=username,
            avatar_url=avatar,
            wait=True,
            content=content,
            files=[],
            embeds=[],
            allowed_mentions=discord.AllowedMentions(
                  everyone=False,
                  users=False,
                  roles=False,
                  replied_user=False))

catDB = ForgiveDB("./chatcat.json")
async def processMW(group, message):
  async with aiohttp.ClientSession() as session: 
    servers = catDB.get("servers")
    if message.content == "uwa":
      sendMwMsg(group, "wat", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      return
    if message.content == "Can you come?":
      sendMwMsg(group, "Sure!", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      servers.append(message.channel.id)
      catDB.set("servers", servers)
      return
    if message.content == "Can you leave?":
      sendMwMsg(group, "Okay.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      servers.remove(message.channel.id)
      catDB.set("servers", servers)
      return
    if message.content == "Are you here?":
      if message.channel.id in servers:
        sendMwMsg(group, "Yes!", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      else:
        sendMwMsg(group, "No.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      return
    if message.channel.id in servers:
      if "herb" in message.content.lower() and "type" in message.content.lower():
        sendMwMsg(group, "I have many types of herbs.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "i'm" in message.content.lower() and "dad" in message.content.lower():
        sendMwMsg(group, "I'm not laughing.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "herb" in message.content.lower() and "many" in message.content.lower():
        sendMwMsg(group, "I have a lot of herbs.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "herb" in message.content.lower() and "have" in message.content.lower():
        sendMwMsg(group, "I don't give herbs away.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "herb" in message.content.lower():
        sendMwMsg(group, "What about my herbs?", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "who" in message.content.lower() and "you" in message.content.lower():
        sendMwMsg(group, "I'm a cat.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "who" in message.content.lower() and (message.author.name.lower() in message.content.lower() or message.author.display_name.lower() in message.content.lower()):
        sendMwMsg(group, "You are.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "hi" in message.content.lower() or "hello" in message.content.lower() or "hey" in message.content.lower():
        sendMwMsg(group, "Hi!", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "how" in message.content.lower() and "you" in message.content.lower():            sendMwMsg(group, "I'm doing good!", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "breed" in message.content.lower() and "you" in message.content.lower():
        sendMwMsg(group, "I'm a norwegian forest cat.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "gender" in message.content.lower() and "you" in message.content.lower():
        sendMwMsg(group, "I'm a male.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif ("birthday" in message.content.lower() or "old" in message.content.lower() or "age" in message.content.lower()) and "you" in message.content.lower():
        sendMwMsg(group, "I don't want people to know my age.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "acepogs" in message.content.lower() and "legal" in message.content.lower():
        sendMwMsg(group, "Cats don't consider people \"legal\" or not", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "acepogs" in message.content.lower():
        sendMwMsg(group, "I like Acepogs' code.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "mijo" in message.content.lower():
        sendMwMsg(group, "Mijo is the best!", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "mylo" in message.content.lower():
        sendMwMsg(group, "I like Mylo the Cat since he is the coolest cat on the internet.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "cool" in message.content.lower() and "cat" in message.content.lower():
        sendMwMsg(group, "Mylo the Cat is the coolest cat on the internet", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "youtuber" in message.content.lower():
        sendMwMsg(group, "My favorite YouTuber is Mijo_games2017", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "viewers" in message.content.lower() and "war" in message.content.lower():
        sendMwMsg(group, "I don't like the violence in Viewers' War", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "kerb" in message.content.lower():
        sendMwMsg(group, "I don't have any strong opinions on Kerbalista", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "code" in message.content.lower():
        sendMwMsg(group, "Cats can't code!", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "math" in message.content.lower():
        sendMwMsg(group, "Cats can't do math!", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "train" in message.content.lower():
        sendMwMsg(group, "I don't let people train me.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "tuna" in message.content.lower():
        sendMwMsg(group, "I love tuna.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "feed" in message.content.lower():
        sendMwMsg(group, "You can feed me.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "treat" in message.content.lower():
        sendMwMsg(group, "I love treats.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "hungry" in message.content.lower():
        sendMwMsg(group, "I'm not hungry.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "understand" in message.content.lower():
        sendMwMsg(group, "Sorry for not understanding you.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "it" in message.content.lower() and "okay" in message.content.lower():
        sendMwMsg(group, "Thank you.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "you" in message.content.lower() and "welcome" in message.content.lower():
        sendMwMsg(group, "Purr.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "meow" in message.content.lower():
        sendMwMsg(group, "Meow.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "purr" in message.content.lower():
        sendMwMsg(group, "Purr.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "hiss" in message.content.lower():
        sendMwMsg(group, "Why did you hiss at me?", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "uwa" in message.content.lower():
        sendMwMsg(group, "So temperate?", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      elif "uwu" in message.content.lower():
        sendMwMsg(group, "Don't uwu me.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")
      else:
        sendMwMsg(group, "I'm not sure I understand.", "Cat - Temmie Village", "https://images2.alphacoders.com/879/879332.jpg")

@bot.listen('on_message')
async def on_message(message):
  #if str(message.author.id) == "862046044862021682":
    #await message.author.add_roles(message.guild.get_role(1099631641510551668))
  #print(", ".join([str(r.name) + ":" + str(r.id) for r in message.guild.roles]))
  #channel = await bot.fetch_channel("1099631642064199686")
  #print(await channel.create_invite(max_age = 3600, max_uses = 1))
  async with aiohttp.ClientSession() as session:  
    for index, group in enumerate(servers):
      for server in group:
        if message.channel.id != server["channel"] or message.webhook_id == server["wid"]:
          continue
        entry = {}
        for server2 in group:
          if server2["name"] == server["name"]:
            continue
          while 1:
            try:
              webhook = discord.Webhook.from_url(
                server2["webhook"],
                session=session
#              adapter=discord.AsyncWebhookAdapter(session))
              )
              files = []
              for attachment in message.attachments:
                files.append(await attachment.to_file())
              #if message.content == "" and len(message.embeds) == 0:
              #return
              name = None
              if message.author.global_name is None:
                name = message.author.name
              else:
                name = message.author.global_name
              entry[server2["name"]] = (await webhook.send(username=name + " - " + server["name"],
                     avatar_url=message.author.avatar.url if message.webhook_id != None else message.author.display_avatar.url,
                     wait=True,
                     content=message.stickers[0].url if len(message.stickers) > 0 else ("*Empty message*" if message.content == "" and len(message.embeds) == 0 and len(files) == 0 else message.content),
                     files=files,
                     embeds=message.embeds,
                     allowed_mentions=discord.AllowedMentions(
                         everyone=False,
                         users=False,
                         roles=False,
                         replied_user=False))).id
              entry["__group"] = index
              map[message.id] = entry
              map_db.set("map", map)
              #await processMW(group, message)
              break
            except Exception as exception:
              print(traceback.format_exc())
              if "404 Not Found" in str(exception):
                print("Someone deleted the webhook for " + server2["name"])
     
                print("URL: " + server2["webhook"])
                break
              if "Temporary failure in name resolution" in str(exception):
                os.system("kill 1")
              #continue

@bot.listen('on_raw_message_edit')
async def on_raw_message_edit(payload):
  if payload.message_id not in map:
    return
  
  channel = bot.get_channel(payload.channel_id)
  message = await channel.fetch_message(payload.message_id)

  entry = map[payload.message_id]
  async with aiohttp.ClientSession() as session:  
    for server in servers[entry["__group"]]:
      if server["name"] not in entry:
        continue
        
      webhook = discord.Webhook.from_url(
        server["webhook"],
        session=session
#        adapter=discord.AsyncWebhookAdapter(session)
      )
      files = []
      for attachment in message.attachments:
        files.append(await attachment.to_file())
      await webhook.edit_message(
        message_id=entry[server["name"]],
        content=message.content,
        attachments=files,
        embeds=message.embeds,
        allowed_mentions=discord.AllowedMentions(
          everyone=False,
          users=False,
          roles=False,
          replied_user=False))

@bot.listen('on_raw_message_delete')
async def on_raw_message_delete(payload):
  if payload.message_id not in map:
    return
  
  entry = map[payload.message_id]
  async with aiohttp.ClientSession() as session:  
    for server in servers[entry["__group"]]:
      if server["name"] not in entry:
        continue
        
      webhook = discord.Webhook.from_url(
        server["webhook"],
        session=session
#        adapter=discord.AsyncWebhookAdapter(session))
      )
      await webhook.delete_message(
        entry[server["name"]],
      )

@bot.listen('on_raw_bulk_message_delete')
async def on_raw_bulk_message_delete(payload):
  for message_id in payload.message_ids:
    if message_id not in map:
      return
  
    entry = map[message_id]
    async with aiohttp.ClientSession() as session:  
      for server in servers[entry["__group"]]:
        if server["name"] not in entry:
          continue
          
        webhook = discord.Webhook.from_url(
          server["webhook"],
          session=session
#                    adapter=discord.AsyncWebhookAdapter(session))
        )
        await webhook.delete_message(
          entry[server["name"]],
        )

        

bot.run(token)
