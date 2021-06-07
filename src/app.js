const Discord = require("discord.js");
const express = require("express");
const fs = require("fs");
const path = require("path")
if (!fs.existsSync(path.join(__dirname, "/db.json"))) fs.writeFileSync(path.join(__dirname, "/db.json"), "{}");
const db = require("./db.json");
const fetch = require("node-fetch");

const client = new Discord.Client();
const app = express();

const config = require("../config.json");

const redirect_uri = `https://discord.com/api/oauth2/authorize?client_id=${
  config.discord_id
}&redirect_uri=${encodeURIComponent(
  config.discord_redirect
)}&response_type=code&scope=guilds.join%20identify`;

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", (msg) => {
  let allowed = false;

  const intersect = config.admins.filter((role) =>
    msg.member.roles.cache.has(role)
  );

  if (intersect.length > 0 || config.admins.includes(msg.author.id)) {
    const command = msg.content.split(" ")[0];

    if (config.commands[command]) {
      const route = config.commands[command];
      const user_id = msg.content.split(" ")[1];

      if (!db[user_id]) db[user_id] = [];
      db[user_id].push(route.id);
      fs.writeFileSync(path.join(__dirname, "/db.json"), JSON.stringify(db));

      msg.react("👍");
    }
  }
});

app.get("/accepted", (req, res) => {
  res.redirect(redirect_uri);
});

app.get("/auth", async (req, res) => {
  const code = req.query.code;

  const data = {
    client_id: config.discord_id,
    client_secret: config.discord_secret,
    grant_type: "authorization_code",
    redirect_uri: config.discord_redirect,
    code: code,
    scope: "identify email guilds.join",
  };

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    body: new URLSearchParams(data),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  }).then((res) => res.json());

  const token = tokenResponse.access_token;

  const user_id = (
    await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => res.json())
  ).id;

  // console.log(user_id);

  const routeIds = db[user_id];

  let roles = [];

//   const user = await client.users.fetch(user_id);

  Object.keys(config.commands).forEach(async (key) => {
    const route = config.commands[key];
    if (routeIds.includes(route.id)) {
      roles.push(route.doj_role);
      client.guilds.fetch(route.server).then((guild) => {
        guild.addMember(user_id, {
          accessToken: token,
        });
      });
    }
  });

  console.log(roles);

  if (roles.length > 0) {
    client.guilds.fetch(config.doj_server).then(async (guild) => {
      await guild.addMember(user_id, {
        accessToken: token
      });

      guild.member(user_id).roles.set(roles);
    });

    res.redirect("/success");
  } else {
    res.redirect("/denied");
  }
});

client.login(config.discord_token);
app.listen(80);
