const Discord = require('discord.js');
const express = require("express");
const db = require('quick.db');

const client = new Discord.Client();
const app = express();

const config = require("../config.json");

const redirect_uri =
    `https://discord.com/api/oauth2/authorize?client_id=${config.discord_id}&redirect_uri=${encodeURIComponent(config.discord_redirect)}&response_type=code&scope=guilds.join%20identify`;

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", msg => {
    const command = msg.content.split(" ")[0];

    if (config.commands[command]) {
        const route = config.commands[command];
        const user_id = msg.content.split(" ")[1];

        db.push(user_id, route.id);

        msg.reply("👍");
    }
});

app.get("/accepted", (req, res) => {
    res.redirect(redirect_uri);
});

app.get("/auth", (req, res) => {
    const code = req.query.code;

    const data = {
        client_id: config.discord_id,
        client_secret: config.discord_secret,
        grant_type: 'authorization_code',
        redirect_uri: config.discord_redirect,
        code: code,
        scope: 'identify email guilds.join',
    };

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams(data),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    }).then(res => res.json())

    const token = tokenResponse.access_token;

    const user_id = (await fetch("https://discord.com/api/users/@me", { headers: { "Authorization": `Bearer ${token}` } }).then(res => res.json())).id;

    const routeIds = db.get(user_id);
    
    let roles = [];

    config.commands.forEach(route => {
        if (routeIds.includes(route.id)) {
            roles.push(route.doj_role);
            await fetch(`https://discord.com/api/guilds/${route.server}/members/${user_id}`,
            {
                headers: { "Authorization": `Bearer ${config.discord_token}` },
                body: JSON.stringify({
                    access_token: token
                }),
                method: "PUT"
            }
        );
        }
    });

    if (roles.length > 0) {
        await fetch(`https://discord.com/api/guilds/${config.doj_server}/members/${user_id}`,
        {
            headers: { "Authorization": `Bearer ${config.discord_token}` },
            body: JSON.stringify({
                access_token: token,
                roles
            }),
            method: "PUT"
        });

        res.redirect("/success");
    } else {
        res.redirect("/denied");
    }

});

client.login(config.discord_token);
app.listen(80);