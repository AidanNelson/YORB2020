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
const http = require('http').createServer(app);

//Port and server setup
const port = process.env.PORT || 1989;

//Server
const server = app.listen(port);

//EJS
const ejs = require('ejs');

//Console the port
console.log('Server is running localhost on port: ' + port);

/////SOCKET.IO///////
const io = require('socket.io').listen(server);

//Setup the views folder
app.set("views", __dirname + '/views');

//Setup ejs, so I can write HTML(:
app.engine('.html', ejs.__express);
app.set('view-engine', 'html');

//Setup the public client folder
app.use(express.static(__dirname + '/public'));

// Twilio network traversal (ICE servers) for WebRTC peer connections
const accountSid = process.env.TWILIO_ACCOUNT_SID || "ACdb900f036056c60ff9da6571562c4293";
const authToken = process.env.TWILIO_AUTH_TOKEN || "59cc6d11aa0bd3ae0649f6d4b5ecff52";

const twilioClient = require('twilio')(accountSid, authToken);
let iceToken;
let iceServers;

twilioClient.tokens.create().then(token => {
  iceToken = token;
  iceServers = token.iceServers;
  console.log("Got ICE Server credentials from Twilio.");
});

let clients = {};


//Socket setup
io.on('connection', client => {

  console.log('User ' + client.id + ' connected, there are ' + io.engine.clientsCount + ' clients connected');

  //Add a new client indexed by his id
  clients[client.id] = {
    position: [0, 0, 0],
    rotation: [0, 0, 0]
  }

  //Make sure to send the client it's ID and a list of ICE servers for WebRTC network traversal 
  client.emit('introduction', client.id, io.engine.clientsCount, Object.keys(clients), iceServers);
  // also give the client all existing clients positions:
  client.emit('userPositions', clients);

  //Update everyone that the number of users has changed
  io.sockets.emit('newUserConnected', io.engine.clientsCount, client.id, Object.keys(clients));

  client.on('move', (pos) => {
    clients[client.id].position = pos;
    io.sockets.emit('userPositions', clients);
  });

  //Handle the disconnection
  client.on('disconnect', () => {

    //Delete this client from the object
    delete clients[client.id];

    io.sockets.emit('userDisconnected', io.engine.clientsCount, client.id, Object.keys(clients));

    console.log('User ' + client.id + ' diconnected, there are ' + io.engine.clientsCount + ' clients connected');

  });

  // from simple chat app:
  // WEBRTC Communications
  client.on("call-user", (data) => {
    console.log('Server forwarding call from ' + client.id + " to " + data.to);
    client.to(data.to).emit("call-made", {
      offer: data.offer,
      socket: client.id
    });
  });

  client.on("make-answer", data => {
    client.to(data.to).emit("answer-made", {
      socket: client.id,
      answer: data.answer
    });
  });

  client.on("reject-call", data => {
    client.to(data.from).emit("call-rejected", {
      socket: client.id
    });
  });

  // ICE Setup
  client.on('addIceCandidate', data => {
    client.to(data.to).emit("iceCandidateFound", {
      socket: client.id,
      candidate: data.candidate
    });
  });
});




/////////////////////
//////ROUTER/////////
/////////////////////

//Client view
app.get('/', (req, res) => {

  res.render('index.html');

});

//404 view
app.get('/*', (req, res) => {

  res.render('404.html');

});
