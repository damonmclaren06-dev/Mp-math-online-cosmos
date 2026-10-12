const http = require('http');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws', maxPayload: 16 * 1024 });
const PORT = Number(process.env.PORT) || 3000;
const GAME_ID = 'mr-pryer-maths-v7.4-cosmos';
const rooms = new Map();
const clients = new Map();
app.disable('x-powered-by');
app.get('/health', (_req, res) => res.status(200).json({ ok: true, service: 'mr-pryer-maths-v7.4-cosmos-alpha', rooms: rooms.size, players: clients.size }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

function send(socket, payload) { if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload)); }
function error(socket, message) { send(socket, { type: 'error', message }); }
function cleanName(value, fallback) { if (typeof value !== 'string') return fallback; const name = value.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 20); return name || fallback; }
function makeCode() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code; do { code = Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join(''); } while (rooms.has(code)); return code; }
function roomSnapshot(room) { return { code: room.code, hostId: room.hostId, hostName: room.hostName, started: room.started, settings: room.settings, players: [...room.players].map(id => { const p = room.members.get(id); return { id, name: p.name, role: p.role, score: p.score, correct: p.correct, assists: p.assists, mischief: p.mischief, connected: true }; }) }; }
function broadcast(room, payload) { for (const id of room.players) send(room.members.get(id)?.socket, payload); }
function updateRoom(room) { broadcast(room, { type: 'lobby:update', lobby: roomSnapshot(room) }); }
function removeClientFromRoom(client, socket) {
  if (!client?.roomCode) return;
  const room = rooms.get(client.roomCode); const code = client.roomCode; client.roomCode = null;
  if (!room) return;
  room.players.delete(client.id); room.members.delete(client.id);
  if (room.players.size === 0) rooms.delete(code);
  else if (room.hostId === client.id) {
    broadcast(room, { type: 'room:closed', message: 'Commander disconnected. The lobby has closed.' });
    for (const id of room.players) { const peer = room.members.get(id); if (peer) { peer.client.roomCode = null; } }
    rooms.delete(code);
  } else { broadcast(room, { type: 'system:message', message: `${client.name} left the lobby.` }); updateRoom(room); }
}
function getRoom(client, socket) { const room = rooms.get(client.roomCode); if (!room) error(socket, 'You are not in an active lobby.'); return room; }
function limitedText(v, max=120) { return typeof v === 'string' ? v.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0,max) : ''; }

wss.on('connection', socket => {
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const client = { id, socket, roomCode: null, name: 'Player', role: 'pilot', lastAction: 0 };
  clients.set(socket, client);
  send(socket, { type:'server-ready', game:GAME_ID, message:'Mr Pryer Maths V7.4 Cosmos server ready.' });
  socket.on('message', raw => {
    let data; try { data = JSON.parse(raw.toString()); } catch { return error(socket, 'Please send valid JSON.'); }
    if (!data || typeof data.type !== 'string') return error(socket, 'Message is missing a type.');
    if (data.game && data.game !== GAME_ID) return error(socket, 'This server is for Mr Pryer Maths V7.4 Cosmos.');
    const c = clients.get(socket); if (!c) return;
    if (data.type === 'room:create') {
      if (c.roomCode) removeClientFromRoom(c, socket);
      const code = makeCode(); const base = cleanName(data.playerName, 'Commander');
      c.name = `Commander ${base}`; c.role = 'commander'; c.roomCode = code;
      const room = { code, hostId:id, hostName:c.name, players:new Set([id]), members:new Map([[id,{id, socket, client:c, name:c.name, role:'commander', score:0, correct:0, assists:0, mischief:0}]]), started:false, settings:{ mode:'co-op', difficulty:'standard', mischief:true, maxPlayers:2 }, createdAt:Date.now() };
      rooms.set(code, room); send(socket,{type:'room-created',code,playerId:id,role:'commander',playerName:c.name,lobby:roomSnapshot(room)}); updateRoom(room); return;
    }
    if (data.type === 'room:join') {
      const code = typeof data.code === 'string' ? data.code.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6) : '';
      const room = rooms.get(code); if (!room) return error(socket,'Lobby not found. Check the code and make sure the Commander is still connected.');
      if (room.players.size >= room.settings.maxPlayers) return error(socket,'This lobby is full.');
      if (room.started) return error(socket,'This expedition has already started.');
      if (c.roomCode) removeClientFromRoom(c, socket);
      c.name = `Pilot ${cleanName(data.playerName,'Player')}`; c.role = 'pilot'; c.roomCode = code;
      room.players.add(id); room.members.set(id,{id,socket,client:c,name:c.name,role:'pilot',score:0,correct:0,assists:0,mischief:0});
      broadcast(room,{type:'system:message',message:`${c.name} joined the lobby.`}); send(socket,{type:'room-joined',code,playerId:id,role:'pilot',playerName:c.name,lobby:roomSnapshot(room)}); updateRoom(room); return;
    }
    if (data.type === 'room:leave') { const old = c.roomCode; removeClientFromRoom(c,socket); send(socket,{type:'room-left',code:old}); return; }
    const room = getRoom(c,socket); if (!room) return;
    const member = room.members.get(id); if (!member) return error(socket,'Your lobby session expired.');
    if (data.type === 'host:start') {
      if (room.hostId !== id) return error(socket,'Only the Commander can launch the expedition.');
      if (room.players.size < 2) return error(socket,'Waiting for a Pilot to join before launch.');
      room.started = true; broadcast(room,{type:'game:started',lobby:roomSnapshot(room)}); updateRoom(room); return;
    }
    if (data.type === 'host:settings') {
      if (room.hostId !== id) return error(socket,'Only the Commander can change lobby settings.');
      if (room.started) return error(socket,'Settings are locked after launch.');
      room.settings.mischief = data.mischief !== false;
      room.settings.mode = data.mode === 'versus' ? 'versus' : 'co-op';
      broadcast(room,{type:'system:message',message:`Commander updated the lobby settings.`}); updateRoom(room); return;
    }
    if (data.type === 'game:score') {
      const score = Number(data.score), correct = Number(data.correct);
      if (Number.isFinite(score)) member.score = Math.max(0,Math.min(100000,Math.floor(score)));
      if (Number.isFinite(correct)) member.correct = Math.max(0,Math.min(10000,Math.floor(correct)));
      updateRoom(room); return;
    }
    if (data.type === 'action:assist' || data.type === 'action:mischief') {
      if (!room.started) return error(socket,'Launch the expedition before using player actions.');
      if (data.type === 'action:mischief' && !room.settings.mischief) return error(socket,'Commander has disabled mischief actions.');
      const now = Date.now(); if (now - c.lastAction < 8000) return error(socket,'Action cooldown: wait a few seconds before doing that again.'); c.lastAction = now;
      const targetId = room.players.size > 1 ? [...room.players].find(otherId => otherId !== id) : null;
      if (!targetId) return error(socket,'No other player to target.');
      const target = room.members.get(targetId);
      if (data.type === 'action:assist') { member.assists++; send(target.socket,{type:'player:effect',effect:'assist',from:member.name,message:`${member.name} sent you a hint boost! Your next hint is free.`}); send(socket,{type:'player:effect',effect:'assist-sent',from:target.name,message:`Support delivered to ${target.name}.`}); }
      else { member.mischief++; const effect = ['static','time-tax','coin-prank'][Math.floor(Math.random()*3)]; const messages = {static:`${member.name} sent a static burst! Your next question is briefly scrambled.`, 'time-tax':`${member.name} launched a harmless time-tax prank. Lose 5 seconds in Time Attack.`, 'coin-prank':`${member.name} nicked 5 coins for the prank fund.`}; send(target.socket,{type:'player:effect',effect,from:member.name,message:messages[effect]}); send(socket,{type:'player:effect',effect:'mischief-sent',from:target.name,message:`Mischief delivered to ${target.name}.`}); }
      updateRoom(room); return;
    }
    if (data.type === 'chat:send') { const message = limitedText(data.message,140); if (!message) return; broadcast(room,{type:'chat:message',from:c.name,message,at:Date.now()}); return; }
    if (data.type === 'game:relay') { broadcast(room,{type:'game:relay',from:c.name,payload:data.payload}); return; }
    error(socket,`Unknown message type: ${data.type}`);
  });
  socket.on('close',()=>{ removeClientFromRoom(client,socket); clients.delete(socket); });
  socket.on('error',()=>{ removeClientFromRoom(client,socket); clients.delete(socket); });
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Mr Pryer Maths V7.4 Cosmos server listening on port ${PORT}`));
