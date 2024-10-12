import client from "./client.js"

export const dataMsg = await (await client.channels.fetch("1231358988461805568")).messages.fetch("1231359413852311593")
export const dataContent = JSON.parse(dataMsg.content)
export const saveData = async () => await dataMsg.edit(JSON.stringify(dataContent))