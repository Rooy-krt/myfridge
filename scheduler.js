const { getSchedule, markTriggered } = require("./db");
const { publishCommand } = require("./mqttListener");

// Runs every minute. Compares "now" (HH:MM) against on_time/off_time and
// fires the matching command once per minute-match (guarded so a slow tick
// or restart doesn't refire the same minute twice).
function startScheduler() {
  setInterval(() => {
    const schedule = getSchedule();
    if (!schedule.enabled) return;

    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const minuteKey = `${now.toDateString()} ${hhmm}`;

    if (minuteKey === schedule.last_triggered_minute) return; // already handled this minute

    if (hhmm === schedule.on_time) {
      if (publishCommand("ON")) {
        console.log(`Schedule: turning fridge ON at ${hhmm}`);
        markTriggered(minuteKey);
      }
    } else if (hhmm === schedule.off_time) {
      if (publishCommand("OFF")) {
        console.log(`Schedule: turning fridge OFF at ${hhmm}`);
        markTriggered(minuteKey);
      }
    }
  }, 15000); // check every 15s so a match near the minute boundary isn't missed
}

module.exports = { startScheduler };
