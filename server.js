const express = require('express');
const service = require('./parkingService');
const events = require('./events');

const app = express();
app.use(express.json());

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

app.post('/check-in', wrap(async (req, res) => {
  res.status(201).json(await service.checkIn(req.body.plate, req.body.type));
}));

app.post('/check-out', wrap(async (req, res) => {
  res.json(await service.checkOut(req.body.ticketId));
}));

app.get('/availability', wrap(async (req, res) => {
  res.json(await service.getAvailability());
}));

app.get('/availability/stream', wrap(async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send(await service.getAvailability());
  events.on('availability', send);
  req.on('close', () => events.off('availability', send));
}));

app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal server error' });
});

const port = process.env.PORT || 3000;
if (require.main === module) app.listen(port, () => console.log(`Parking API on :${port}`));
module.exports = app;
