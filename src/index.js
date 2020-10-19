/*
 * YORB 2020
 *
 * Aidan Nelson, April 2020
 *
 */

//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// IMPORTS
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

import Scene from "./scene";

const io = require("socket.io-client");
const socketPromise = require("./libs/socket.io-promise").promise;

import * as mediasoup from "mediasoup-client";
import debugModule from "debug";

const log = debugModule("YORB");
const warn = debugModule("YORB:WARN");
const err = debugModule("YORB:ERROR");

// load p5 for self view
const p5 = require("p5");

import {joinRoom, startCamera, sendCameraStreams, getCamPausedState, getMicPausedState, toggleWebcamAudioPauseState, toggleWebcamVideoPauseState, createDevice } from "./Comms";

//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// Setup Global Variables:
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

// TODO: https://www.mattburkedev.com/export-a-global-to-the-window-object-with-browserify/

//
// export all the references we use internally to manage call state,
// to make it easy to tinker from the js console. for example:
//
//   `Client.camVideoProducer.paused`
//
export let mySocketID,
  socket,
  yorbScene,
  projects = [],
  miniMapSketch,
  selfViewSketch,
  initialized = false;

window.clients = {}; // array of connected clients for three.js scene
window.lastPollSyncData = {};



//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// Start-Up Sequence:
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

// start with user interaction with the DOM so we can auto-play audio/video from
// now on...
window.onload = async () => {
  console.log("Window loaded.");

  createScene();
  createMiniMap();

	await createDevice();

  await initSocketConnection();

  // use sendBeacon to tell the server we're disconnecting when
  // the page unloads
  window.addEventListener("unload", () => {
    socket.request("leave", {});
  });

  alert("Allow YORB to access your webcam for the full experience");
  await startCamera();
  createSelfView()

  var startButton = document.getElementById("startButton");
  startButton.addEventListener("click", init);
};

async function init() {
  yorbScene.controls.lock();
  document.getElementById("instructions-overlay").style.visibility = "visible";

  // only join room after we user has interacted with DOM (to ensure that media elements play)
  if (!initialized) {
    await joinRoom();
    sendCameraStreams();
    setupControls();
    initialized = true;
  }
}

//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// Socket.io
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

// establishes socket connection
// uses promise to ensure that we receive our so
function initSocketConnection() {
  return new Promise((resolve) => {
    console.log("Initializing socket.io...");
    socket = io("wss://yorb.itp.io");
    socket.request = socketPromise(socket);

    socket.on("connect", () => {});

    //On connection server sends the client his ID and a list of all keys
    socket.on("introduction", (_id, _ids) => {
      // keep a local copy of my ID:
      console.log("My socket ID is: " + _id);
      mySocketID = _id;

      // for each existing user, add them as a client and add tracks to their peer connection
      for (let i = 0; i < _ids.length; i++) {
        if (_ids[i] != mySocketID) {
          addClient(_ids[i]);
        }
      }
      resolve();
    });

    // when a new user has entered the server
    socket.on("newUserConnected", (clientCount, _id, _ids) => {
      console.log(clientCount + " clients connected");

      if (!(_id in clients)) {
        if (_id != mySocketID) {
          console.log("A new user connected with the id: " + _id);
          addClient(_id);
        }
      }
    });

    socket.on("projects", (_projects) => {
      console.log("Received project list from server.");
      updateProjects(_projects);
    });

    socket.on("userDisconnected", (_id, _ids) => {
      // Update the data from the server

      if (_id in clients) {
        if (_id == mySocketID) {
          console.log("Uh oh!  The server thinks we disconnected!");
        } else {
          console.log("A user disconnected with the id: " + _id);
          yorbScene.removeClient(_id);
          removeClientDOMElements(_id);
          delete clients[_id];
        }
      }
    });

    // Update when one of the users moves in space
    socket.on("userPositions", (_clientProps) => {
      yorbScene.updateClientPositions(_clientProps);
    });
  });
}

//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// Clients / WebRTC
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

// Adds client object with THREE.js object, DOM video object and and an RTC peer connection for each :
async function addClient(_id) {
  console.log("Adding client with id " + _id);
  clients[_id] = {};
  yorbScene.addClient(_id);
}

function updateProjects(_projects) {
  projects = _projects;
  if (yorbScene.springShow.updateProjects) {
    yorbScene.springShow.updateProjects(projects);
  }
}

//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// Three.js 🌻
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

function onPlayerMove() {
  socket.emit("move", yorbScene.getPlayerPosition());
}

export function hackToRemovePlayerTemporarily() {
  console.log("removing user temporarily");
  let pos = [0, 10000, 0];
  let rotation = [0, 0, 0];
  socket.emit("move", [pos, rotation]);

  for (let _id in clients) {
    pauseAllConsumersForPeer(_id);
  }
}

function createScene() {
  // initialize three.js scene
  console.log("Creating three.js scene...");

  yorbScene = new Scene(onPlayerMove, clients, mySocketID);

  updateProjects();
}

//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// User Interface 🚂
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

// notes for myself (and anyone else...)
// the webcam can be in a few different states:
// 	- we have not yet requested user media
// 	- we have requested user media but have been denied
// 	- we do have user media

// the send transport can be in a few different states:
// 	- we have not yet set it up
// 	- we have set it up and are currently sending camera and microphone feeds
// 	- we have set it up, but are not sending camera or microphone feeds (i.e. we are paused)

function setupControls() {
  window.addEventListener(
    "keyup",
    (e) => {
      if (e.keyCode == 67) {
        // "C"
		toggleWebcamVideoPauseState();
		toggleWebcamImage();
      }
      if (e.keyCode == 77) {
        // "M"
		toggleWebcamAudioPauseState();
		toggleMicrophoneImage();
      }
      if (e.keyCode == 49) {
        // "1"
        yorbScene.swapMaterials();
      }
      if (e.keyCode == 80) {
        // 'p'
        console.log(yorbScene.getPlayerPosition()[0]);
      }
    },
    false
  );
}

function toggleWebcamImage() {
  let webcamImage = document.getElementById("webcam-status-image");
  if (getCamPausedState()) {
    webcamImage.src = "images/no-webcam.png";
  } else {
    webcamImage.src = "images/webcam.png";
  }
}

function toggleMicrophoneImage() {
  let micImg = document.getElementById("microphone-status-image");
  if (getMicPausedState()) {
    micImg.src = "images/no-mic.png";
  } else {
    micImg.src = "images/mic.png";
  }
}

// adapted (with ❤️) from Dan Shiffman: https://www.youtube.com/watch?v=rNqaw8LT2ZU
async function createSelfView() {
  const s = (sketch) => {
    let video;
    var vScale = 10;
    let ballX = 100;
    let ballY = 100;
    let velocityX = sketch.random(-5, 5);
    let velocityY = sketch.random(-5, 5);
    let buffer = 10;

    sketch.setup = () => {
      let canvas = sketch.createCanvas(260, 200);
      ballX = sketch.width / 2;
      ballY = sketch.height / 2;
      sketch.pixelDensity(1);
      video = sketch.createCapture(sketch.VIDEO);
      video.size(sketch.width / vScale, sketch.height / vScale);
      video.hide();
      sketch.frameRate(5);
      sketch.rectMode(sketch.CENTER);
      sketch.ellipseMode(sketch.CENTER);
    };

    sketch.draw = () => {
      if (getCamPausedState()) {
        // bouncing ball easter egg sketch:
        sketch.background(10, 10, 200);
        ballX += velocityX;
        ballY += velocityY;
        if (ballX >= sketch.width - buffer || ballX <= buffer) {
          velocityX = -velocityX;
        }
        if (ballY >= sketch.height - buffer || ballY <= buffer) {
          velocityY = -velocityY;
        }
        sketch.fill(240, 120, 0);
        sketch.ellipse(ballX, ballY, 10, 10);
      } else {
        sketch.background(0);
        video.loadPixels();
        for (var y = 0; y < video.height; y++) {
          for (var x = 0; x < video.width; x++) {
            var index = (video.width - x + 1 + y * video.width) * 4;
            var r = video.pixels[index + 0];
            var g = video.pixels[index + 1];
            var b = video.pixels[index + 2];
            var bright = (r + g + b) / 3;
            var w = sketch.map(bright, 0, 255, 0, vScale);
            sketch.noStroke();
            sketch.fill(255);
            sketch.rectMode(sketch.CENTER);
            sketch.rect(x * vScale, y * vScale, w, w);
          }
        }
      }
    };
  };
  selfViewSketch = new p5(
    s,
    document.getElementById("self-view-canvas-container")
  );
  selfViewSketch.canvas.style = "display: block; margin: 0 auto;";
}

// creates minimap p5 sketch
async function createMiniMap() {
  const s = (sketch) => {
    let mapImg = false;

    sketch.setup = () => {
      mapImg = sketch.loadImage("images/map.png");
      sketch.createCanvas(300, 300);
      sketch.pixelDensity(1);
      sketch.frameRate(5);
      sketch.ellipseMode(sketch.CENTER);
      sketch.imageMode(sketch.CENTER);
      sketch.angleMode(sketch.RADIANS);
    };

    sketch.draw = () => {
      sketch.background(0);
      sketch.push();

      // translate to center of sketch
      sketch.translate(sketch.width / 2, sketch.height / 2);
      //translate to 0,0 position of map and make all translations from there
      let playerPosition = yorbScene.getPlayerPosition();
      let posX = playerPosition[0][0];
      let posZ = playerPosition[0][2];

      // TODO add in direction...
      // let myDir = playerPosition[1][1]; // camera rotation about Y in Euler Radians

      // always draw player at center:
      sketch.push();
      sketch.fill(255, 255, 0);
      sketch.ellipse(0, 0, 7, 7);
      // TODO add in direction...
      // sketch.fill(0, 0, 255,150);
      // sketch.rotate(myDir);
      // sketch.triangle(0, 0, -10, -30, 10, -30);
      sketch.pop();

      let mappedX = sketch.map(posZ, 0, 32, 0, -225, false);
      let mappedY = sketch.map(posX, 0, 32, 0, 225, false);
      // allow for map load time without using preload, which seems to mess with things in p5 instance mode...
      sketch.push();
      sketch.rotate(Math.PI);
      sketch.translate(mappedX, mappedY);
      if (mapImg) {
        sketch.image(mapImg, 0, 0, mapImg.width, mapImg.height);
      }
      for (let id in clients) {
        let pos = clients[id].group.position; // [x,y,z] array of position
        let yPos = sketch.map(pos.x, 0, 32, 0, -225, false);
        let xPos = sketch.map(pos.z, 0, 32, 0, 225, false);
        sketch.push();
        sketch.fill(100, 100, 255);
        sketch.translate(xPos, yPos);
        sketch.ellipse(0, 0, 5, 5);
        sketch.pop();
      }
      sketch.pop();
      sketch.pop();
    };
  };
  miniMapSketch = new p5(
    s,
    document.getElementById("mini-map-canvas-container")
  );
  miniMapSketch.canvas.style = "display: block; margin: 0 auto;";
}

// remove <video> element and corresponding <canvas> using client ID
function removeClientDOMElements(_id) {
  console.log("Removing DOM elements for client with ID: " + _id);

  let videoEl = document.getElementById(_id + "_video");
  if (videoEl != null) {
    videoEl.remove();
  }
  let canvasEl = document.getElementById(_id + "_canvas");
  if (canvasEl != null) {
    canvasEl.remove();
  }
  let audioEl = document.getElementById(_id + "_audio");
  if (audioEl != null) {
    audioEl.remove();
  }
}
