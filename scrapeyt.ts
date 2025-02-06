export type Image = {
    url: string,
    width: string,
    height: string
}
export type ImageAttachment = Image[];
export type VideoAttachment = {
    videoId: string,
    thumbnails: Image[],
    title: string,
    descriptionSnippet?: string,
    publishedTimeText?: string,
    lengthText: {
        short?: string,
        long?: string,
    },
    viewCountText?: string,
    url?: string,
    onesie?: string,
    owner: {
        name?: string,
        url?: string,
        id?: string,
        thumbnails?: Image[]
    },
    shortViewCountText?: string,
}
export type PollAttachment = {
    choices: string[],
    totalVotes: string,
    pollType: string,
}
export type MultiImageAttachment = ImageAttachment[];
export type QuizAttachment = {
    choices: {
        text: string,
        explanation: string,
        isCorrect: boolean
    }[],
    totalVotes: string,
    quizType: string,
    enableAnimation: boolean,
    disableChangingQuizAnswer: boolean
}
export type Attachment = {
    image?: ImageAttachment,
    video?: VideoAttachment,
    poll?: PollAttachment,
    multiImage?: MultiImageAttachment,
    quiz?: QuizAttachment
}
export type Post = {
    postId: string,
    author: {
        name: string,
        url: string,
        id: string,
        thumbnails: Image[]
    },
    content: {
        text: string,
        url?: string,
        webPageType?: string
    }[],
    attachment: Attachment,
    publishedTimeText: string,
    voteCount?: string,
    comments?: string | null,
    sharedPost: Post | null,
    isSharedPost: boolean
}
export const scrapePosts = async (channelId: string, onlyFirstPage?: boolean) => {
    const originalUrl = "https://www.youtube.com/channels/" + channelId + "/community"
    const browse = async (metadata: any) => {
        const response = await fetch("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
            method: "POST",
            body: JSON.stringify({
                "context": {
                    "client": {
                        "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36,gzip(gfe)",
                        "clientName": "WEB",
                        "clientVersion": "2.20250122.04.00",
                        "originalUrl": originalUrl,
                        "platform": "DESKTOP",
                        "browserName": "Chrome",
                        "browserVersion": "117.0.0.0",
                        "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                        "utcOffsetMinutes": 0
                    }
                },
                ...metadata
            })
        });
        if (!response.ok) throw response;
        console.log(response.status)
        return await response.json();
    };
    const response = await browse({
        browseId: channelId,
        params: "Egljb21tdW5pdHnyBgQKAkoA"
    });
    const parsePost = (rawPost: any, originalPost: any, isShared: boolean): Post => {
        const attachment = {} as Attachment;
        if (rawPost.backstageAttachment) {
            if (rawPost.backstageAttachment.backstageImageRenderer) {
                attachment.image = rawPost.backstageAttachment.backstageImageRenderer.image.thumbnails
            }
            if (rawPost.backstageAttachment.videoRenderer) {
                attachment.video = {
                    videoId: rawPost.backstageAttachment.videoRenderer.videoId,
                    thumbnails: rawPost.backstageAttachment.videoRenderer.thumbnail.thumbnails,
                    title: rawPost.backstageAttachment.videoRenderer.title.runs?.[0].text ?? rawPost.backstageAttachment.videoRenderer.title.simpleText,
                    descriptionSnippet: rawPost.backstageAttachment.videoRenderer.descriptionSnippet?.runs[0].text,
                    publishedTimeText: rawPost.backstageAttachment.videoRenderer.publishedTimeText?.simpleText,
                    lengthText: {
                        short: rawPost.backstageAttachment.videoRenderer.lengthText?.simpleText,
                        long: rawPost.backstageAttachment.videoRenderer.lengthText?.accessibility.accessibilityData.label,
                    },
                    viewCountText: rawPost.backstageAttachment.videoRenderer.viewCountText?.simpleText,
                    url: rawPost.backstageAttachment.videoRenderer.navigationEndpoint?.commandMetadata.webCommandMetadata.url,
                    onesie: rawPost.backstageAttachment.videoRenderer.navigationEndpoint?.watchEndpoint.watchEndpointSupportedOnesieConfig.html5PlaybackOnesieConfig.commonConfig.url,
                    owner: {
                        name: rawPost.backstageAttachment.videoRenderer.ownerText?.runs[0].text,
                        url: rawPost.backstageAttachment.videoRenderer.ownerText?.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url,
                        id: rawPost.backstageAttachment.videoRenderer.ownerText?.runs[0].navigationEndpoint.browseEndpoint.browseId,
                        thumbnails: rawPost.backstageAttachment.videoRenderer.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer.thumbnail.thumbnails
                    },
                    shortViewCountText: rawPost.backstageAttachment.videoRenderer.shortViewCountText?.simpleText,
                }
            }
            if (rawPost.backstageAttachment.pollRenderer) {
                attachment.poll = {
                    choices: rawPost.backstageAttachment.pollRenderer.choices.map((choice: any) => choice.text.runs[0].text),
                    totalVotes: rawPost.backstageAttachment.pollRenderer.totalVotes.simpleText,
                    pollType: rawPost.backstageAttachment.pollRenderer.type,
                }
            }
            if (rawPost.backstageAttachment.postMultiImageRenderer) {
                attachment.multiImage = rawPost.backstageAttachment.postMultiImageRenderer.images.map((image: any) => image.backstageImageRenderer.image.thumbnails);
            }
            if (rawPost.backstageAttachment.quizRenderer) {
                attachment.quiz = {
                    choices: rawPost.backstageAttachment.quizRenderer.choices.map((choice: any) => ({
                        text: choice.text.runs[0].text,
                        explanation: choice.explanation.runs[0].text,
                        isCorrect: choice.isCorrect
                    })),
                    totalVotes: rawPost.backstageAttachment.quizRenderer.totalVotes.simpleText,
                    quizType: rawPost.backstageAttachment.quizRenderer.type,
                    enableAnimation: rawPost.backstageAttachment.enableAnimation,
                    disableChangingQuizAnswer: rawPost.backstageAttachment.disableChangingQuizAnswer,
                }
            }
        }
        const rawAuthor = isShared ? rawPost.displayName : rawPost.authorText
        return {
            postId: rawPost.postId,
            author: {
                name: rawAuthor.runs[0].text,
                url: rawAuthor.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url,
                id: rawAuthor.runs[0].navigationEndpoint.browseEndpoint.browseId,
                thumbnails: (isShared ? rawPost.thumbnail : rawPost.authorThumbnail).thumbnails
            },
            content: (isShared ? rawPost.content : rawPost.contentText).runs?.map((run: any) => ({
                text: run.text,
                url: run.navigationEndpoint?.commandMetadata.webCommandMetadata.url,
                webPageType: run.navigationEndpoint?.commandMetadata.webCommandMetadata.webPageType
            })),
            attachment: attachment,
            publishedTimeText: rawPost.publishedTimeText.runs[0].text,
            voteCount: rawPost.voteCount?.simpleText,
            comments: isShared ? null : originalPost.actionButtons.commentActionButtonsRenderer.replyButton.buttonRenderer.text?.simpleText,
            sharedPost: isShared && rawPost.originalPost ? parsePost(rawPost.originalPost.backstagePostRenderer, originalPost.originalPost.backstagePostRenderer, false) : null,
            isSharedPost: isShared
        }
    }
    let posts: Post[] = [];
    const parseItemSections = async (itemSections: any[]) => {
        for (const itemSection of itemSections) {
            if (itemSection.backstagePostThreadRenderer) {
                const sharedPostRenderer = itemSection.backstagePostThreadRenderer.post.sharedPostRenderer;
                const rawPost = itemSection.backstagePostThreadRenderer.post.backstagePostRenderer ?? sharedPostRenderer;
                console.log(rawPost.postId)
                const postResponse = await browse({
                    browseId: channelId,
                    params: rawPost.publishedTimeText.runs[0].navigationEndpoint.browseEndpoint.params
                })
                if (!postResponse.contents.twoColumnBrowseResultsRenderer.tabs.find((tab: any) => tab.tabRenderer?.title === "Community" || tab.tabRenderer?.title === "Posts").tabRenderer.content) {
                    console.warn(rawPost.postId + " could not found full post?");
                    posts.push(parsePost(rawPost, rawPost, !!sharedPostRenderer))
                    continue;
                }
                const directPost = postResponse.contents.twoColumnBrowseResultsRenderer.tabs.find((tab: any) => tab.tabRenderer?.title === "Community" || tab.tabRenderer?.title === "Posts").tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[0].backstagePostThreadRenderer.post[sharedPostRenderer ? "sharedPostRenderer" : "backstagePostRenderer"];
                posts.push(parsePost(directPost, rawPost, !!sharedPostRenderer))
            } else if (itemSection.continuationItemRenderer) {
                const continuation = await browse({
                    continuation: itemSection.continuationItemRenderer.continuationEndpoint.continuationCommand.token
                });
                if (!continuation.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems) {
                    console.log(continuation)
                    console.log(continuation.onResponseReceivedEndpoints[0])
                    console.warn("Could not find continuation")
                    return
                }
                if (!onlyFirstPage) await parseItemSections(continuation.onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems)
            }
        }
    }
    await parseItemSections(response.contents.twoColumnBrowseResultsRenderer.tabs.find((tab: any) => tab.tabRenderer?.title === "Community" || tab.tabRenderer?.title === "Posts").tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents)
    return posts;
}