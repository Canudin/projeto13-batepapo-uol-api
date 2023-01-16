import axios, { all } from "axios";
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";

const server = express();
const PORT = 5000;
server.use(cors());
server.use(express.json());

dotenv.config();
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect().then(() => {
  db = mongoClient.db();
});

server.post("/participants", async (req, res) => {
  const newUser = req.body.name;
  const timestamp = Date.now();
  if (!newUser) return res.sendStatus(422);
  try {
    const existUser = await db.collection("participants").findOne({ name: newUser });
    if (existUser) return res.status(409).send("Participante já existe");

    await db.collection("participants").insertOne({
      name: newUser,
      lastStatus: timestamp,
    });

    await db.collection("messages").insertOne({
      from: newUser,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs(timestamp).format("HH:mm:ss"),
    });

    return res.sendStatus(201);
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

server.get("/participants", async (req, res) => {
  const allUsers = await db.collection("participants").find().toArray();
  return res.status(200).send(allUsers);
});

server.post("/messages", async (req, res) => {
  const userMessage = req.body;
  const fromUser = req.headers.user;

  const msgSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
  });
  const msgValidation = msgSchema.validate(userMessage);
  const existUser = await db.collection("participants").findOne({ name: fromUser });
  if (msgValidation.error) {
    const errors = msgValidation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }
  if (!existUser) return res.status(422).send("User not found");

  await db.collection("messages").insertOne({
    from: fromUser,
    to: userMessage.to,
    text: userMessage.text,
    type: userMessage.type,
    time: dayjs().format("HH:mm:ss"),
  });
  return res.sendStatus(201);
});

server.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  if (limit <= 0) return res.sendStatus(422);

  const allMsgs = await db.collection("messages").find().toArray();
  if (!limit) {
    const allPublicMessages = allMsgs.filter((oneMsg) => {
      oneMsg.type === "message" || oneMsg.type === "status";
    });
    return res.status(200).send(allMsgs);
  }

  const userMsgs = allMsgs.filter(
    (oneMsg) =>
      oneMsg.from === req.headers.user ||
      oneMsg.to === req.headers.user ||
      oneMsg.type === "message" ||
      oneMsg.type === "status"
  );
  const lastUserMsgs = await userMsgs.reverse().slice(0, limit);
  return res.status(200).send(lastUserMsgs);
});

server.post("/status", async (req, res) => {
  const fromUser = req.headers.user;
  const timestamp = Date.now();
  try {
    const updated = await db
      .collection("participants")
      .updateOne({ name: fromUser }, { lastStatus: { $set: timestamp } });
    if (updated.modifiedCount === 0) return res.sendStatus(404);
    return res.sendStatus(200);
  } catch (err) {
    return res.status(500).send(err);
  }
});

setInterval(async () => {
  const getLimitTimestamp = Date.now() - 10000; //set timestamp limit to be now minus 10s
  const getInactiveUsers = await db
    .collection("participants")
    .find({ lastStatus: { $lt: getLimitTimestamp } })
    .toArray();
  getInactiveUsers.forEach(async (inactiveUser) => {
    await db.collection("messages").insertOne({
      from: inactiveUser.name,
      to: "Todos",
      text: "sai da sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
  });
  const deleteInactiveUsers = await db
    .collection("participants")
    .deleteMany({ lastStatus: { $lt: getLimitTimestamp } });
}, 15000);

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
