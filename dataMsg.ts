import client from "./client.js";
import type { TextChannel } from "discord.js";

export const dataMsg = await (await client.channels.fetch("1231358988461805568") as TextChannel).messages.fetch("1231359413852311593");
const attachmentText = await (await fetch([...dataMsg.attachments.values()][0].url)).text()
export const dataContent = JSON.parse(attachmentText);
let isSaving = false;
let waitingListeners: Function[] = [];
let lastSavedString = "";
export const saveData = async (fromWaiting?: boolean) => {
    if (!fromWaiting && isSaving) {
        const {promise, resolve} = Promise.withResolvers();
        waitingListeners.push(resolve);
        await promise;
        if (lastSavedString !== JSON.stringify(dataContent)) await saveData();
        return;
    }
    const currentListeners = [...waitingListeners]
    console.log("\x1b[36m%s\x1b[0m", "Saving...")
    isSaving = true;
    lastSavedString = JSON.stringify(dataContent);
    await dataMsg.edit({
        "files": [
            {
                "attachment": Buffer.from(JSON.stringify(dataContent), "utf8"),
                "name": "data.json"
            }
        ]
    });
    if (waitingListeners.length - currentListeners.length > 0) {
        saveData(true);
    }
    isSaving = false;
    console.log("\x1b[36m%s\x1b[0m", "Saved!")
    for (const listener of currentListeners) {
        listener();
        waitingListeners.splice(waitingListeners.indexOf(listener), 1)
    }
    console.log("\x1b[36m%s\x1b[0m", currentListeners.length + " save requests have now finished.")
}

let isShuttingDown = false;
process.on("SIGINT", async () => {
    if (isShuttingDown) {
        console.log("\x1b[36m%s\x1b[0m", "Forcefully shutting down.");
        process.exit();
    }
    if (isSaving) {
        isShuttingDown = true;
        console.log("\x1b[36m%s\x1b[0m", "Saving data before shutdown...");
        const {promise, resolve} = Promise.withResolvers();
        waitingListeners.push(resolve);
        await promise;
    }
	process.exit();
});