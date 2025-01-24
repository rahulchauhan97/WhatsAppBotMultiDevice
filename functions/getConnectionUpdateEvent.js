const fs = require("fs");
const { readdir } = require("fs/promises");
const { stopInterval } = require("./getInterval");
const { DisconnectReason } = require("@adiwajshing/baileys");

const getConnectionUpdate = async (startSock, events) => {
    const update = events;
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
        console.log(lastDisconnect.error.output.statusCode, DisconnectReason.loggedOut);

        const statusCode = lastDisconnect.error.output.statusCode;
        const disconnectionActions = {
            [DisconnectReason.loggedOut]: async () => {
                try {
                    let path = "./baileys_auth_info/";
                    let filenames = await readdir(path);
                    filenames.forEach((file) => {
                        fs.unlinkSync(path + file);
                    });
                } catch { }
                stopInterval();
                startSock("logout");
            },
            515: () => startSock("reconnecting"),
            403: () => startSock("error"),
            default: () => startSock()
        };

        const action = disconnectionActions[statusCode] || disconnectionActions.default;
        await action();
    }
    console.log("connection update", update);
}

module.exports = getConnectionUpdate;
