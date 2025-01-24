const { delay } = require("../utils");
const fs = require("fs");
const ownerSend_sock = require("./getOwnerSend");
const prefix = process.env.PREFIX;
const moderatos = ["918318585490@s.whatsapp.net", ...process.env.MODERATORS?.split(",")];
const getGroupAdmins = require("./getGroupAdmins");
const stickerForward = require("../stickerForward");
const { createMembersData, getMemberData, member } = require("../mongo-DB/membersDataDb");
const { createGroupData, getGroupData, group } = require("../mongo-DB/groupDataDb");
const { commandsPublic, commandsMembers, commandsAdmins, commandsOwners } = require("./getAddCommands");
const myNumber = process.env.MY_NUMBER;
let forwardGroup = "";

const getCommand = async (sock, msg, cache) => {
    const sendMessageWTyping = async (jid, content, options) => {
        await delay(1000);
        await sock.presenceSubscribe(jid);
        await delay(2000);
        await sock.sendPresenceUpdate("composing", jid);
        await delay(1000);
        await sock.sendPresenceUpdate("paused", jid);
        await sock.sendMessage(jid, content, { ...options, mediaUploadTimeoutMs: 1000 * 60 });
    };

    const from = msg.key.remoteJid;
    const msgContent = JSON.stringify(msg.message);
    const type = Object.keys(msg.message)[0];

    if (type === "stickerMessage" && forwardGroup !== "") {
        stickerForward(sock, msg, from);
    }

    let botNumber = sock.user.id;
    botNumber = botNumber.includes(":") ? botNumber.split(":")[0] + "@s.whatsapp.net" : botNumber;

    let text = type === "conversation" ? msg.message.conversation : type === "imageMessage" && msg.message.imageMessage.caption ? msg.message.imageMessage.caption : type === "videoMessage" && msg.message.videoMessage.caption ? msg.message.videoMessage.caption : type === "extendedTextMessage" && msg.message.extendedTextMessage.text ? msg.message.extendedTextMessage.text : type === "buttonsResponseMessage" ? msg.message.buttonsResponseMessage.selectedButtonId : type === "listResponseMessage" ? msg.message.listResponseMessage.singleSelectReply.selectedRowId : type === "templateButtonReplyMessage" ? msg.message.templateButtonReplyMessage.selectedId : "";

    if (type === "buttonsResponseMessage") {
        if (msg.message.buttonsResponseMessage.selectedDisplayText === "help") {
            text = text.startsWith(prefix) ? text : prefix + text;
        }
    } else if (type === "listResponseMessage") {
        text = text.startsWith(prefix) ? text : prefix + text;
    } else if (type === "templateButtonReplyMessage") {
        if (msg.message.templateButtonReplyMessage.selectedDisplayText === "help") {
            text = text.startsWith(prefix) ? text : prefix + text;
        }
    }

    if (text[0] === " ") {
        text = text[0] + text.slice(1);
    }

    const args = text.trim().split(/ +/).slice(1);
    const command = text.slice(1).trim().split(/ +/).shift().toLowerCase();
    const isCmd = text.startsWith(prefix);

    if (!isCmd && type === "stickerMessage") return;

    const isGroup = from.endsWith("@g.us");
    const sender = isGroup ? msg.key.participant : from;
    const senderName = isGroup ? sock.user.name : msg.pushName;

    if (isGroup && (type === "conversation" || type === "extendedTextMessage")) {
        member.updateOne({ _id: sender }, { $inc: { totalmsg: 1 }, $set: { username: senderName } });
        createMembersData(sender, senderName);
    }

    let groupMetadata = "";
    if (isGroup && (type === "conversation" || type === "extendedTextMessage")) {
        groupMetadata = cache.get(from + ":groupMetadata");
        if (!groupMetadata) {
            groupMetadata = await sock.groupMetadata(from);
            cache.set(from + ":groupMetadata", groupMetadata, 3600);
            createGroupData(from, groupMetadata);
        }
        group.updateOne({ _id: from, "members.id": sender }, { $inc: { "members.$.count": 1 }, $set: { "members.$.name": senderName } }).then(res => {
            if (res.matchedCount === 0) {
                group.updateOne({ _id: from }, { $push: { members: { id: sender, name: senderName, count: 1 } } });
            }
        });
        group.updateOne({ _id: from }, { $inc: { totalMsgCount: 1 } });
    }

    if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo?.mentionedJid.includes(botNumber)) {
        sock.sendMessage(from, { sticker: fs.readFileSync("./media/tag.webp") }, { quoted: msg });
    }

    const senderNumber = sender.includes(":") ? sender.split(":")[0] : sender.split("@")[0];
    const memberData = await getMemberData(sender);
    const groupData = isGroup ? await getGroupData(from) : "";

    if (isGroup && type === "imageMessage" && groupData?.isAutoStickerOn && msg.message.imageMessage.url) {
        console.log("Auto Sticker");
        commandsPublic["sticker"](sock, msg, from, args, { senderJid: sender, type, content: msgContent, isGroup, sendMessageWTyping, evv: args });
    }

    if (isGroup && type === "videoMessage" && groupData?.isAutoStickerOn && msg.message.videoMessage.url) {
        console.log("Auto Sticker");
        commandsPublic["sticker"](sock, msg, from, args, { senderJid: sender, type, content: msgContent, isGroup, sendMessageWTyping, evv: args });
    }

    if (isGroup && type === "stickerMessage" && groupData?.isAutoStickerOn && msg.message.stickerMessage.url) {
        console.log("Auto Sticker");
        commandsPublic["sticker"](sock, msg, from, args, { senderJid: sender, type, content: msgContent, isGroup, sendMessageWTyping, evv: args });
    }

    if (isGroup && (type === "conversation" || type === "extendedTextMessage") && groupData?.isBotOn) {
        if (text === "") {
            console.log("Empty message");
            commandsPublic["help"](sock, msg, from, args, { senderJid: sender, type, content: msgContent, isGroup, sendMessageWTyping, evv: args });
        }
    }

    if (isGroup && (type === "conversation" || type === "extendedTextMessage") && groupData?.isChatBotOn && text !== "") {
        if (text === "help" || text === "Help") {
            sendMessageWTyping(from, { text: `🤖 Chatbot is turned off in this group.\nUse ${prefix}help to activate.` }, { quoted: msg });
        }
    }

    if (isGroup && (type === "conversation" || type === "extendedTextMessage") && groupData?.cmdBlocked.includes(command)) {
        sendMessageWTyping(from, { text: "❎ This command is blocked for this group." }, { quoted: msg });
        return;
    }

    if (commandsPublic[command]) {
        return commandsPublic[command](sock, msg, from, args, { prefix, type, content: msgContent, evv: args, command, isGroup, senderJid: sender, groupMetadata, groupAdmins: isGroup ? getGroupAdmins(groupMetadata.participants) : "", botNumberJid: botNumber, sendMessageWTyping, ownerSend: ownerSend_sock });
    } else if (commandsMembers[command]) {
        return isGroup || msg.key.fromMe ? commandsMembers[command](sock, msg, from, args, { prefix, type, content: msgContent, evv: args, command, isGroup, senderJid: sender, groupMetadata, groupAdmins: isGroup ? getGroupAdmins(groupMetadata.participants) : "", botNumberJid: botNumber, sendMessageWTyping, ownerSend: ownerSend_sock }) : sendMessageWTyping(from, { text: "❎ This command is only applicable in groups." }, { quoted: msg });
    } else if (commandsAdmins[command]) {
        if (!isGroup) {
            return sendMessageWTyping(from, { text: "❎ This command is only applicable in groups." }, { quoted: msg });
        } else {
            const isAdmin = isGroup ? getGroupAdmins(groupMetadata.participants).includes(sender) : false;
            return isAdmin || moderatos.includes(senderNumber) ? commandsAdmins[command](sock, msg, from, args, { prefix, type, content: msgContent, evv: args, command, isGroup, senderJid: sender, groupMetadata, groupAdmins: isGroup ? getGroupAdmins(groupMetadata.participants) : "", botNumberJid: botNumber, sendMessageWTyping, ownerSend: ownerSend_sock }) : sendMessageWTyping(from, { text: "❎ This command is only for group admins." }, { quoted: msg });
        }
    } else if (commandsOwners[command]) {
        return moderatos.includes(senderNumber) || myNumber === sender ? commandsOwners[command](sock, msg, from, args, { prefix, type, content: msgContent, evv: args, command, isGroup, senderJid: sender, groupMetadata, groupAdmins: isGroup ? getGroupAdmins(groupMetadata.participants) : "", botNumberJid: botNumber, sendMessageWTyping, ownerSend: ownerSend_sock }) : sendMessageWTyping(from, { text: "❎ This command is only for the owner." }, { quoted: msg });
    } else {
        return sendMessageWTyping(from, { text: `❎ Command not found: ${command}\nUse ${prefix}help for the list of commands.` }, { quoted: msg });
    }
};

module.exports = getCommand;
