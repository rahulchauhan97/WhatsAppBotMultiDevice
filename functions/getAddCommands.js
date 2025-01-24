const fs = require("fs");
const path = require("path");
const mainPath = path.join(__dirname, "../commands/");

let commandsPublic = {};
let commandsMembers = {};
let commandsAdmins = {};
let commandsOwners = {};

const addCommands = async () => {
    const readCommandFiles = async (dir) => {
        const filenames = await fs.promises.readdir(dir);
        filenames.forEach((file) => {
            if (file.endsWith(".js")) {
                const { command } = require(path.join(dir, file));
                const cmd_info = command();
                for (const c of cmd_info.cmd) {
                    if (dir.includes("public")) {
                        commandsPublic[c] = cmd_info.handler;
                    } else if (dir.includes("members")) {
                        commandsMembers[c] = cmd_info.handler;
                    } else if (dir.includes("admins")) {
                        commandsAdmins[c] = cmd_info.handler;
                    } else if (dir.includes("owner")) {
                        commandsOwners[c] = cmd_info.handler;
                    }
                }
            }
        });
    };

    await readCommandFiles(mainPath + "public/");
    await readCommandFiles(mainPath + "group/members/");
    await readCommandFiles(mainPath + "group/admins/");
    await readCommandFiles(mainPath + "owner/");

    // deleting the files .webp .jpeg .jpg .mp3 .mp4 .png
    const deleteFilesWithExtensions = async (dir, extensions) => {
        const filenames = await fs.promises.readdir(dir);
        filenames.forEach((file) => {
            if (extensions.some(ext => file.endsWith(ext))) {
                fs.unlinkSync(path.join(dir, file));
            }
        });
    };

    await deleteFilesWithExtensions("./", [".webp", ".jpeg", ".jpg", ".mp3", ".mp4", ".png", ".gif"]);
};

addCommands();

const cmdToText = () => {
    const readCommandFilesToText = async (dir, commandList) => {
        const filenames = await fs.promises.readdir(dir);
        filenames.forEach((file) => {
            if (file.endsWith(".js")) {
                const { command } = require(path.join(dir, file));
                const cmd_info = command();
                commandList.push({ cmd: cmd_info.cmd, desc: cmd_info.desc, usage: cmd_info.usage });
            }
        });
    };

    let adminCommands = [];
    let publicCommands = [];
    let ownerCommands = [];

    return new Promise(async (resolve, reject) => {
        await readCommandFilesToText(mainPath + "public/", publicCommands);
        await readCommandFilesToText(mainPath + "group/members/", publicCommands);
        await readCommandFilesToText(mainPath + "group/admins/", adminCommands);
        await readCommandFilesToText(mainPath + "owner/", ownerCommands);
        resolve({ publicCommands, adminCommands, ownerCommands });
    });
};

module.exports = { commandsPublic, commandsMembers, commandsAdmins, commandsOwners, cmdToText };
