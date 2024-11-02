import client from "./client.js";
import type { TextChannel } from "discord.js";

export const dataMsg = await (await client.channels.fetch("1231358988461805568") as TextChannel).messages.fetch("1231359413852311593");
export const dataContent = JSON.parse(await (await fetch([...dataMsg.attachments.values()][0].url)).text());
export const saveData = async () => await dataMsg.edit({
    "files": [
        {
            "attachment": Buffer.from(JSON.stringify(dataContent), "utf8"),
            "name": "data.json"
        }
    ]
});