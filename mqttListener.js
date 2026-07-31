// Requires: npm install mqtt
const mqtt = require("mqtt");
const { getLatestStatus, saveLatestStatus, addEvent, addReading } = require("./db");

const MQTT_URL = process.env.MQTT_URL || "mqtts://fe5fa55957644bae8568e62c988c3811.s1.eu.hivemq.cloud:8883";
const MQTT_USER = process.env.MQTT_USER || undefined;
const MQTT_PASS = process.env.MQTT_PASS || undefined;
const TOPIC_STATUS = process.env.TOPIC_STATUS || "fridge01/status";
const TOPIC_CMD = process.env.TOPIC_CMD || "fridge01/cmd";

let client = null;

function startMqttListener() {
  client = mqtt.connect(MQTT_URL, { username: MQTT_USER, password: MQTT_PASS });

  client.on("connect", () => {
    console.log("Backend connected to MQTT broker");
    client.subscribe(TOPIC_STATUS);
  });

  client.on("error", (err) => console.error("MQTT error:", err.message));

  client.on("message", (topic, payload) => {
    if (topic !== TOPIC_STATUS) return;

    let status;
    try {
      status = JSON.parse(payload.toString());
    } catch {
      console.warn("Bad status payload:", payload.toString());
      return;
    }

    const previous = getLatestStatus();

    // Relay flipped ON<->OFF: log how long the previous state lasted
    if (previous && previous.relay !== status.relay) {
      addEvent({
        type: "relay_change",
        event: status.relay,
        duration_seconds: status.relay === "ON" ? previous.off_seconds : previous.session_seconds,
      });
    }

    // New outage value reported (bigger than what we already knew about)
    if (status.last_outage_seconds > 0 && (!previous || status.last_outage_seconds !== previous.last_outage_seconds)) {
      addEvent({
        type: "outage",
        event: null,
        duration_seconds: status.last_outage_seconds,
      });
    }

    saveLatestStatus(status);
    addReading(status);
  });

  return client;
}

// Used by the /command REST endpoint to relay app commands to the device
function publishCommand(command) {
  if (!client || !client.connected) return false;
  client.publish(TOPIC_CMD, command);
  return true;
}

module.exports = { startMqttListener, publishCommand };
