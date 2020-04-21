/* 
* YORB 2020
* 
* This server uses code from a THREE.js Multiplayer boilerplate made by Or Fleisher:
* https://github.com/juniorxsound/THREE.Multiplayer
* And a WEBRTC chat app made by Mikołaj Wargowski:
* https://github.com/Miczeq22/simple-chat-app
*
* Aidan Nelson, April 2020
*
*/

//////EXPRESS////////
const express = require('express');
const app = express();

////////HTTP/////////
// const http = require('http');
// const httpServer = http.createServer(app);

//Port and server setup
const port = process.env.PORT || 1989;

//Server
const server = app.listen(port);

//Console the port
console.log('Server is running localhost on port: ' + port);

/////SOCKET.IO///////
const io = require('socket.io').listen(server);

//Setup the public client folder
app.use(express.static(__dirname + '/public'));

// Add environment variables:
// https://www.twilio.com/blog/2017/08/working-with-environment-variables-in-node-js.html
// https://stackoverflow.com/questions/21831945/heroku-node-env-environment-variable
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
// Twilio network traversal (ICE servers) for WebRTC peer connections
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const twilioClient = require('twilio')(accountSid, authToken);
let iceToken;
let iceServers = null;

twilioClient.tokens.create().then(token => {
  iceToken = token;
  iceServers = token.iceServers;
  console.log("Got ICE Server credentials from Twilio.");
  console.log(token.iceServers);
});

let clients = {};


//Socket setup
io.on('connection', client => {

  console.log('User ' + client.id + ' connected, there are ' + io.engine.clientsCount + ' clients connected');

  //Add a new client indexed by his id
  clients[client.id] = {
    position: [0, 0.5, 0],
    rotation: [0, 0, 0, 1] // stored as XYZW values of Quaternion
  }

  //Make sure to send the client it's ID and a list of ICE servers for WebRTC network traversal 
  client.emit('introduction', client.id, io.engine.clientsCount, Object.keys(clients), iceServers);

  // also give the client all existing clients positions:
  client.emit('userPositions', clients);

  //Update everyone that the number of users has changed
  io.sockets.emit('newUserConnected', io.engine.clientsCount, client.id, Object.keys(clients));

  client.on('move', (data) => {
    if (clients[client.id]) {
      clients[client.id].position = data[0];
      clients[client.id].rotation = data[1];
    }
    io.sockets.emit('userPositions', clients);
  });

  //Handle the disconnection
  client.on('disconnect', () => {

    //Delete this client from the object
    delete clients[client.id];
    io.sockets.emit('userDisconnected', io.engine.clientsCount, client.id, Object.keys(clients));
    console.log('User ' + client.id + ' diconnected, there are ' + io.engine.clientsCount + ' clients connected');

  });
  
  // SimplePeer Signaling
  client.on("signal", (data) => {
    console.log('Server forwarding signaling data from ' + client.id + " to " + data.to);
    client.to(data.to).emit("signal", {
      signal: data.signal,
      socket: client.id
    });
  });
});