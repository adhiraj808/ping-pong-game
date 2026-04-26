const fs = require('fs');
const path = require('path');

const wsUrl = process.env.PONG_WS_URL || '';
const configPath = path.resolve(__dirname, '..', 'client', 'config.js');
const configSource = `window.PONG_CONFIG = ${JSON.stringify({ wsUrl }, null, 2)};\n`;

fs.writeFileSync(configPath, configSource);

if (wsUrl) {
    console.log(`Wrote client WebSocket URL: ${wsUrl}`);
} else {
    console.warn('PONG_WS_URL is empty. Online mode will use the same host as the frontend.');
}
