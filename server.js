// Requires: npm install express cors dotenv
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { getLatestStatus, getHistory, getReadings, getSchedule, updateSchedule } = require("./db");
const { startMqttListener, publishCommand } = require("./mqttListener");
const { startScheduler } = require("./scheduler");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/status/latest", (req, res) => {
  const status = getLatestStatus();
  if (!status) return res.status(404).json({ error: "No status received yet" });
  res.json(status);
});

app.get("/history", (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  res.json(getHistory(limit));
});

app.post("/command", (req, res) => {
  const { command } = req.body;
  if (command !== "ON" && command !== "OFF") {
    return res.status(400).json({ error: "command must be 'ON' or 'OFF'" });
  }
  const sent = publishCommand(command);
  if (!sent) return res.status(503).json({ error: "MQTT broker not connected" });
  res.json({ ok: true, command });
});

app.get("/readings", (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  res.json(getReadings(limit));
});

app.get("/schedule", (req, res) => {
  res.json(getSchedule());
});

app.post("/schedule", (req, res) => {
  const { enabled, on_time, off_time } = req.body;
  const timeRe = /^\d{2}:\d{2}$/;
  if (on_time && !timeRe.test(on_time)) return res.status(400).json({ error: "on_time must be HH:MM" });
  if (off_time && !timeRe.test(off_time)) return res.status(400).json({ error: "off_time must be HH:MM" });
  res.json(updateSchedule({ enabled, on_time, off_time }));
});

startMqttListener();
startScheduler();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
