"use strict";

const { spawnSync } = require("node:child_process");

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const user = required("DB_USER");
const password = required("DB_PASSWORD");
const host = required("DB_HOST");
const port = process.env.DB_PORT || "5432";
const dbName = required("DB_NAME");

process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("pnpm", ["exec", "prisma", "migrate", "deploy"]);
run("pnpm", ["exec", "prisma", "db", "seed"]);
run("node", ["dist/main.js"]);
