import axios, { all } from "axios";
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";

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
    const resp = await db.collection("participants").findOne({ name: newUser });
    if (resp) return res.status(409).send("Participante já existe");

    await db.collection("participants").insertOne({
      name: newUser,
      lastStatus: timestamp
    });

    await db.collection("messages").insertOne({
      from: newUser,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs(timestamp).format("HH:mm:ss")
    })

    return res.status(201).send()
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

server.get("/participants", async (req, res) => {
  const allUsers = await db.collection("participants").find().toArray();
  return res.status(200).send(allUsers);
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
