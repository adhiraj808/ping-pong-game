const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Create an HTTP server to serve static files
const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, '../client', req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath);
    let contentType = 'text/html';

    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': contentType = 'image/jpg'; break;
        case '.ico': contentType = 'image/x-icon'; break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const wss = new WebSocketServer({ server });
const rooms = new Map();

console.log(`Server started on port ${PORT}`);

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

server.listen(PORT);
