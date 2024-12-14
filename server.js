const { WebSocketServer } = require('ws');
const crypto = require('crypto');

// In-memory store of rooms:
// rooms = { roomCode: { players: [ {id, name, color, ws} ], state: {} } }
const rooms = {};

const port = process.env.PORT || 3000;
const wss = new WebSocketServer({ port });

wss.on('connection', (ws) => {
  let currentRoom = null;
  let playerId = crypto.randomBytes(4).toString('hex');

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    switch (data.type) {
      case 'CREATE_ROOM':
        currentRoom = createRoom();
        joinRoom(currentRoom, playerId, data.name, data.color, ws);
        break;
      case 'JOIN_ROOM':
        if (rooms[data.roomCode]) {
          currentRoom = data.roomCode;
          joinRoom(currentRoom, playerId, data.name, data.color, ws);
        } else {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));
        }
        break;
      // In the future, handle more actions like placing edges, moving cats, etc.
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms[currentRoom]) {
      // Remove player from the room
      rooms[currentRoom].players = rooms[currentRoom].players.filter(p => p.id !== playerId);
      broadcastRoomPlayers(currentRoom);

      // If room is empty, delete it
      if (rooms[currentRoom].players.length === 0) {
        delete rooms[currentRoom];
      }
    }
  });
});

function createRoom() {
  // Generate a 4-digit room code
  let roomCode = (Math.floor(Math.random() * 10000)).toString().padStart(4, '0');
  while (rooms[roomCode]) {
    roomCode = (Math.floor(Math.random() * 10000)).toString().padStart(4, '0');
  }
  rooms[roomCode] = {
    players: [],
    state: {}
  };
  return roomCode;
}

function joinRoom(roomCode, playerId, name, color, ws) {
  const player = { id: playerId, name, color, ws };
  rooms[roomCode].players.push(player);

  // Notify this client that they joined
  ws.send(JSON.stringify({ type: 'ROOM_JOINED', roomCode }));

  // Update all players in the room about the player list
  broadcastRoomPlayers(roomCode);
}

function broadcastRoomPlayers(roomCode) {
  const playersInfo = rooms[roomCode].players.map(p => ({ id: p.id, name: p.name, color: p.color }));
  broadcastToRoom(roomCode, {
    type: 'PLAYERS_UPDATE',
    players: playersInfo
  });
}

function broadcastToRoom(roomCode, msgObj) {
  const msg = JSON.stringify(msgObj);
  rooms[roomCode].players.forEach(p => p.ws.send(msg));
}

console.log("Server running on port", port);
