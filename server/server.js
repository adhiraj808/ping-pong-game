const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', () => {
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        console.log(`Room ${roomId} created by ${socket.id}`);
    });

    socket.on('joinRoom', (roomId) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room && room.size < 2) {
            socket.join(roomId);
            socket.emit('roomJoined', roomId);
            socket.to(roomId).emit('playerJoined');
            console.log(`User ${socket.id} joined room ${roomId}`);
        } else {
            socket.emit('error', 'Room is full or does not exist');
        }
    });

    // Synchronize paddle movement
    socket.on('paddleMove', (data) => {
        // data: { roomId, y }
        socket.to(data.roomId).emit('opponentMove', data.y);
    });

    // Synchronize ball state (usually sent by the host)
    socket.on('ballSync', (data) => {
        // data: { roomId, x, y, dx, dy, score1, score2 }
        socket.to(data.roomId).emit('ballUpdate', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
