const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 3000 });
const rooms = new Map(); // Map<code, { host, client }>

console.log('Server started on ws://localhost:3000');

function generateCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

wss.on('connection', (ws) => {
    let currentRoom = null;

    ws.on('message', (data) => {
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
                // Relay game state from host to client
                if (currentRoom) {
                    const r = rooms.get(currentRoom);
                    if (r && r.client) {
                        r.client.send(data.toString());
                    }
                }
                break;

            case 'input':
                // Relay input from client to host
                if (currentRoom) {
                    const r = rooms.get(currentRoom);
                    if (r && r.host) {
                        r.host.send(data.toString());
                    }
                }
                break;
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
