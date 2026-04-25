const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: PORT });
const rooms = new Map(); // Map<code, { host, client }>

console.log(`WebSocket Server started on port ${PORT}`);

function generateCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

wss.on('connection', (ws) => {
    let currentRoom = null;

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);

            switch (msg.type) {
                case 'host':
                    const code = generateCode();
                    rooms.set(code, { host: ws, client: null });
                    currentRoom = code;
                    ws.send(JSON.stringify({ type: 'hosted', code }));
                    console.log(`Room ${code} created`);
                    break;

                case 'join':
                    const joinCode = msg.code;
                    const room = rooms.get(joinCode);
                    if (room && !room.client) {
                        room.client = ws;
                        currentRoom = joinCode;
                        room.host.send(JSON.stringify({ type: 'playerJoined' }));
                        ws.send(JSON.stringify({ type: 'joined', code: joinCode }));
                        console.log(`Player joined room ${joinCode}`);
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: 'Room not found or full' }));
                    }
                    break;

                case 'state':
                    if (currentRoom) {
                        const r = rooms.get(currentRoom);
                        if (r && r.client) r.client.send(data.toString());
                    }
                    break;

                case 'input':
                    if (currentRoom) {
                        const r = rooms.get(currentRoom);
                        if (r && r.host) r.host.send(data.toString());
                    }
                    break;
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                if (room.host === ws) {
                    if (room.client) room.client.send(JSON.stringify({ type: 'disconnected' }));
                    rooms.delete(currentRoom);
                    console.log(`Room ${currentRoom} deleted (host left)`);
                } else if (room.client === ws) {
                    room.host.send(JSON.stringify({ type: 'disconnected' }));
                    room.client = null;
                    console.log(`Player left room ${currentRoom}`);
                }
            }
        }
    });
});
