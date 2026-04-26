const fs = require('fs');
const http = require('http');
const path = require('path');
const { WebSocket, WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const CLIENT_DIR = path.resolve(__dirname, '..', 'client');
const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    let pathname;

    try {
        pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
    } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad request');
        return;
    }

    if (pathname === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('ok');
        return;
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(CLIENT_DIR, relativePath);

    if (!filePath.startsWith(`${CLIENT_DIR}${path.sep}`)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            const status = err.code === 'ENOENT' ? 404 : 500;
            const message = status === 404 ? 'Not found' : 'Server error';
            res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(message);
            return;
        }

        const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
});

const wss = new WebSocketServer({ server });
const rooms = new Map(); // Map<code, { host, client }>
let isShuttingDown = false;

function generateCode() {
    let code;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms.has(code));
    return code;
}

function sendJson(ws, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

function relay(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data.toString());
    }
}

function closeRoom(code, reason) {
    const room = rooms.get(code);

    if (!room) return;

    sendJson(room.host, { type: 'disconnected', message: reason });
    sendJson(room.client, { type: 'disconnected', message: reason });
    rooms.delete(code);
}

wss.on('connection', (ws) => {
    let currentRoom = null;
    ws.isAlive = true;

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (data) => {
        let msg;

        try {
            msg = JSON.parse(data);
        } catch (err) {
            sendJson(ws, { type: 'error', message: 'Invalid message' });
            return;
        }

        switch (msg.type) {
            case 'host':
                if (currentRoom) {
                    sendJson(ws, { type: 'error', message: 'You are already in a room' });
                    return;
                }

                const code = generateCode();
                rooms.set(code, { host: ws, client: null });
                currentRoom = code;
                sendJson(ws, { type: 'hosted', code });
                console.log(`Room ${code} created`);
                break;

            case 'join':
                const joinCode = String(msg.code || '').trim();

                if (currentRoom) {
                    sendJson(ws, { type: 'error', message: 'You are already in a room' });
                    return;
                }

                if (!/^\d{4}$/.test(joinCode)) {
                    sendJson(ws, { type: 'error', message: 'Enter a valid 4-digit room code' });
                    return;
                }

                const room = rooms.get(joinCode);
                if (room && !room.client) {
                    room.client = ws;
                    currentRoom = joinCode;
                    sendJson(room.host, { type: 'playerJoined' });
                    sendJson(ws, { type: 'joined', code: joinCode });
                    console.log(`Player joined room ${joinCode}`);
                } else {
                    sendJson(ws, { type: 'error', message: 'Room not found or full' });
                }
                break;

            case 'state':
                // Relay game state from host to client
                if (currentRoom) {
                    const r = rooms.get(currentRoom);
                    if (r && r.host === ws && r.client) {
                        relay(r.client, data);
                    }
                }
                break;

            case 'input':
                // Relay input from client to host
                if (currentRoom) {
                    const r = rooms.get(currentRoom);
                    if (r && r.client === ws && r.host) {
                        relay(r.host, data);
                    }
                }
                break;

            default:
                sendJson(ws, { type: 'error', message: 'Unknown message type' });
                break;
        }
    });

    ws.on('close', () => {
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                if (room.host === ws) {
                    sendJson(room.client, { type: 'disconnected' });
                    rooms.delete(currentRoom);
                    console.log(`Room ${currentRoom} deleted (host left)`);
                } else if (room.client === ws) {
                    sendJson(room.host, { type: 'disconnected' });
                    room.client = null;
                    console.log(`Player left room ${currentRoom}`);
                }
            }
        }
    });

    ws.on('error', () => {
        if (currentRoom) {
            closeRoom(currentRoom, 'Connection error');
        }
    });
});

const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
            ws.terminate();
            return;
        }

        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('Shutting down server...');

    wss.clients.forEach((ws) => {
        sendJson(ws, { type: 'disconnected' });
        ws.close(1001, 'Server shutting down');
    });

    wss.close(() => {
        server.close(() => {
            process.exit(0);
        });
    });

    setTimeout(() => {
        process.exit(0);
    }, 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, HOST, () => {
    console.log(`Game available at http://localhost:${PORT}`);
    console.log(`WebSocket ready at ws://localhost:${PORT}`);
});
