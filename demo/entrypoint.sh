#!/bin/bash
# Start tmux server with a welcome session so the API works immediately
tmux new-session -d -s zen_welcome -c "$HOME"
exec node /opt/zenterm/dist/index.js
