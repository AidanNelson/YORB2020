'use strict'

/* 
* YORB 2020
* 
* This server uses code from a THREE.js Multiplayer boilerplate made by Or Fleisher:
* https://github.com/juniorxsound/THREE.Multiplayer
* And a WEBRTC chat app made by Mikołaj Wargowski:
* https://github.com/Miczeq22/simple-chat-app
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

//Console the port
console.log('Server is running localhost on port: ' + port );

/////SOCKET.IO///////
const io = require('socket.io').listen(server);

////////EJS//////////
const ejs = require('ejs');

//Setup the views folder
app.set("views", __dirname + '/views');

//Setup ejs, so I can write HTML(:
app.engine('.html', ejs.__express);
app.set('view-engine', 'html');

//Setup the public client folder
app.use(express.static(__dirname + '/public'));

let clients = {}

// from simple-chat-app

let activeSockets = [];



//Socket setup
io.on('connection', client=>{

  console.log('User ' + client.id + ' connected, there are ' + io.engine.clientsCount + ' clients connected');

  //Add a new client indexed by his id
  clients[client.id] = {
    position: [0, 0, 0],
    rotation: [0, 0, 0]
  }

  //Make sure to send the client it's ID
  client.emit('introduction', client.id, io.engine.clientsCount, Object.keys(clients));

  //Update everyone that the number of users has changed
  io.sockets.emit('newUserConnected', io.engine.clientsCount, client.id, Object.keys(clients));

  client.on('move', (pos)=>{

    clients[client.id].position = pos;
    io.sockets.emit('userPositions', clients);

  });

  //Handle the disconnection
  client.on('disconnect', ()=>{

    //Delete this client from the object
    delete clients[client.id];

    io.sockets.emit('userDisconnected', io.engine.clientsCount, client.id, Object.keys(clients));

    console.log('User ' + client.id + ' dissconeted, there are ' + io.engine.clientsCount + ' clients connected');

  });



  // from simple chat app:
  const existingSocket = activeSockets.find(
    existingSocket => existingSocket === client.id
  );

  // if (!existingSocket) {
  //   this.activeSockets.push(client.id);

  //   client.emit("update-user-list", {
  //     users: this.activeSockets.filter(
  //       existingSocket => existingSocket !== client.id
  //     )
  //   });

  //   client.broadcast.emit("update-user-list", {
  //     users: [client.id]
  //   });
  // }

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

  // client.on("disconnect", () => {
  //   this.activeSockets = this.activeSockets.filter(
  //     existingSocket => existingSocket !== client.id
  //   );
  //   client.broadcast.emit("remove-user", {
  //     socketId: client.id
  //   });
  // });


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





