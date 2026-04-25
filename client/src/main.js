import { Game } from './Game.js';
import { io } from 'socket.io-client';

const socket = io(); // Initialize socket connection

const menuOverlay = document.getElementById('menu-overlay');
const roomOverlay = document.getElementById('room-overlay');
const displayRoomId = document.getElementById('display-room-id');
const canvas = document.getElementById('gameCanvas');

// Set internal resolution
canvas.width = 800;
canvas.height = 600;

const game = new Game(canvas);

// --- UI Handlers ---

document.getElementById('btn-single').addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    game.gameMode = 'single';
    game.start();
});

document.getElementById('btn-host').addEventListener('click', () => {
    socket.emit('createRoom');
});

document.getElementById('btn-join').addEventListener('click', () => {
    const roomId = document.getElementById('join-id').value;
    if (roomId) {
        socket.emit('joinRoom', roomId);
    }
});

// --- Socket Handlers ---

socket.on('roomCreated', (roomId) => {
    menuOverlay.classList.add('hidden');
    roomOverlay.classList.remove('hidden');
    displayRoomId.textContent = roomId;
    game.initNetwork(socket, roomId, true);
});

socket.on('roomJoined', (roomId) => {
    menuOverlay.classList.add('hidden');
    game.initNetwork(socket, roomId, false);
    game.start();
});

socket.on('playerJoined', () => {
    roomOverlay.classList.add('hidden');
    game.start();
});

socket.on('error', (msg) => {
    alert(msg);
});
