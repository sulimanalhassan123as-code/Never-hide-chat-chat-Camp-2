// Import required modules
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");

// Initialize Express app and create HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO server
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// This object will store all user information (nickname, room) keyed by socket.id
const users = {};

// Serve the static, self-contained index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // === Handle 'join room' event ===
  socket.on('join room', ({ nickname, room }) => {
    // Store user data
    users[socket.id] = { nickname, room };

    // Have the socket join the specified room
    socket.join(room);

    console.log(`User ${nickname} (ID: ${socket.id}) joined room: ${room}`);

    // Broadcast a 'system message' to everyone *in that room*
    socket.to(room).emit('system message', `${nickname} has joined the event.`);

    // Send an updated user list to everyone *in that room*
    updateUserList(room);
  });

  // === Handle 'chat message' event ===
  socket.on('chat message', (msg) => {
    const user = users[socket.id];

    // If the user is somehow not in our list, ignore the message
    if (!user) return;

    // Broadcast the message to everyone *in that room*
    // We send the nickname along with the message
    io.to(user.room).emit('chat message', { nickname: user.nickname, message: msg });
  });

  // === Handle 'disconnect' event ===
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    const user = users[socket.id];

    // Check if the user was in a room
    if (user) {
      const { nickname, room } = user;

      // Remove the user from our tracking object
      delete users[socket.id];

      // Broadcast a 'system message' to the room they were in
      io.to(room).emit('system message', `${nickname} has left the event.`);

      // Send an updated user list to the room
      updateUserList(room);
    }
  });

  /**
   * Helper function to get all users in a specific room
   * and broadcast the updated list.
   */
  function updateUserList(room) {
    const usersInRoom = [];
    for (const id in users) {
      if (users[id].room === room) {
        usersInRoom.push(users[id].nickname);
      }
    }

    // Send the room name and the list of users
    io.to(room).emit('update user list', {
      roomName: room,
      userList: usersInRoom
    });
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
