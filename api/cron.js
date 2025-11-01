// api/cron.js

export default function handler(req, res) {
  console.log("⏰ Cron job ran at", new Date().toISOString());
  res.status(200).send("Cron job executed");
}
