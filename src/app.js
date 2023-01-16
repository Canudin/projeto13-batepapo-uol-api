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

const mongoClient = new MongoClient("mongodb://localhost:27017");
let db;

mongoClient.connect().then(() => {
  db = mongoClient.db("participants");
});

server.post("/participants", async (req, res) => {
  const newUser = req.body.name;
  const timestamp = Date.now();
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

    return res.status(201).send();
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
  return res.status(201).send();
});

server.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit)
  const allMsgs = await db.collection("messages").find().toArray()
  const userMsgs = await allMsgs.filter((item) => item.from === req.headers.user || item.to === req.headers.user);
  const lastUserMsgs = await userMsgs.reverse().slice(0, limit)
  return res.status(200).send(lastUserMsgs);
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
