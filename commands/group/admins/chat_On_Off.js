const handler = async (sock, msg, from, args, msgInfoObj) => {
    const { groupAdmins, botNumberJid, sendMessageWTyping } = msgInfoObj;
    if (!groupAdmins.includes(botNumberJid)) {
        return sendMessageWTyping(from, { text: `❎ I'm not an admin here` }, { quoted: msg });
    }

    if (!args[0]) {
        return sendMessageWTyping(from, { text: `❎ *Provide nn/off*` }, { quoted: msg });
    }

    args[0] = args[0].toLowerCase();
    try {
        if (args[0] === 'on' || args[0] === 'off') {
            const setting = args[0] === 'on' ? 'not_announcement' : 'announcement';
            const message = args[0] === 'on' ? '✅ *All member can send Message*' : '✅ *Only Admin can send Message*';
            sock.groupSettingUpdate(from, setting);
            sendMessageWTyping(from, { text: message }, { quoted: msg });
        } else {
            return sendMessageWTyping(from, { text: `❎ *Provide right args*` }, { quoted: msg });
        }
    } catch (err) {
        sendMessageWTyping(from, { text: err.toString() }, { quoted: msg });
        console.error(err);
    }
};

module.exports.command = () => ({
    cmd: ["chat"],
    desc: "Enable/disable group chat",
    usage: "chat on/off",
    handler
})
