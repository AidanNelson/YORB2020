/* 
* YORB 2020
* 
* This uses code from a THREE.js Multiplayer boilerplate made by Or Fleisher:
* https://github.com/juniorxsound/THREE.Multiplayer
* And a WEBRTC chat app made by Mikołaj Wargowski:
* https://github.com/Miczeq22/simple-chat-app
*
* 
* Aidan Nelson, April 2020
*
*/

// socket.io
let socket;
let id;

// array of connected clients
let clients = {};

// Variable to store our three.js scene:
let glScene;

let DEBUG_MODE = true;

// WebRTC Variables:
const { RTCPeerConnection, RTCSessionDescription } = window;
let iceServerList;

// set video width / height / framerate here:
const videoWidth = 160;
const videoHeight = 120;
const videoFrameRate = 15;

// Our local media stream (i.e. webcam and microphone stream)
let localMediaStream = null;

// an array of media streams each with different constraints
let localMediaStreams = [];

// Constraints for our local audio/video stream
let mediaConstraints = {
	audio: true,
	video: {
		width: videoWidth,
		height: videoHeight,
		frameRate: videoFrameRate
	}
}


// array of mediaConstraints arranged from highest to lowest quality
let localMediaConstraints = [
	{
		audio: {
			echoCancellation: true,
			noiseSuppression: true
		},
		video: {
			width: videoWidth,
			height: videoHeight,
			frameRate: 1
		}
	},
	{
		audio: {
			echoCancellation: true,
			noiseSuppression: true
		},
		video: {
			width: videoWidth / 2,
			height: videoHeight / 2,
			frameRate: 5
		}
	},
	{
		audio: {
			echoCancellation: true,
			noiseSuppression: true
		},
		video: {
			width: videoWidth / 2,
			height: videoHeight / 2,
			frameRate: 0.5
		}
	}
];






////////////////////////////////////////////////////////////////////////////////
// Start-Up Sequence:
////////////////////////////////////////////////////////////////////////////////

window.onload = async () => {
	console.log("Window loaded.");

	// first get user media
	// localMediaStream = await getMedia(mediaConstraints);

	localMediaStreams = await getLocalMediaStreams(localMediaConstraints)

	// then initialize socket connection
	initSocketConnection();

	// finally create the threejs scene
	createScene();

};





////////////////////////////////////////////////////////////////////////////////
// Local media stream setup
////////////////////////////////////////////////////////////////////////////////

// https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
async function getLocalMediaStreams(_mediaConstraintsArray) {
	let streams = [];
	for (let i = 0; i < _mediaConstraintsArray.length; i++) {
		let stream = null;
		try {
			stream = await navigator.mediaDevices.getUserMedia(_mediaConstraintsArray[i]);
			streams.push(stream);
			// createOrUpdateClientVideo(Math.random(), stream);
		} catch (err) {
			console.log("Failed to get user media!");
			console.warn(err);
		}
	}
	return streams;
}

// https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
async function getMedia(_mediaConstraints) {
	let stream = null;

	try {
		stream = await navigator.mediaDevices.getUserMedia(_mediaConstraints);
	} catch (err) {
		console.log("Failed to get user media!");
		console.warn(err);
	}

	return stream;
}

function addTracksToPeerConnection(_stream, _pc) {
	if (_stream == null) {
		console.log("Local User media stream not yet established!");
	} else {
		_stream.getTracks().forEach(track => {
			_pc.addTrack(track, _stream)
		});
	}
}

////////////////////////////////////////////////////////////////////////////////
// Socket.io
////////////////////////////////////////////////////////////////////////////////

// establishes socket connection
function initSocketConnection() {
	console.log("Initializing socket.io...");
	socket = io();

	socket.on('connect', () => { });

	//On connection server sends the client his ID and a list of all keys
	socket.on('introduction', (_id, _clientNum, _ids, _iceServers) => {
		// keep local copy of ice servers:
		console.log("Received ICE server credentials from server.");
		iceServerList = _iceServers;

		// keep a local copy of my ID:
		console.log('My socket ID is: ' + _id);
		id = _id;

		// for each existing user, add them as a client and add tracks to their peer connection
		for (let i = 0; i < _ids.length; i++) {
			if (_ids[i] != id) {
				addClient(_ids[i], true);
				// callUser(_ids[i]);
			}
		}


	});

	// when a new user has entered the server
	socket.on('newUserConnected', (clientCount, _id, _ids) => {
		console.log(clientCount + ' clients connected');

		let alreadyHasUser = false;
		for (let i = 0; i < Object.keys(clients).length; i++) {
			if (Object.keys(clients)[i] == _id) {
				alreadyHasUser = true;
				break;
			}
		}

		if (_id != id && !alreadyHasUser) {
			console.log('A new user connected with the id: ' + _id);
			addClient(_id, false);
		}

	});

	socket.on('userDisconnected', (clientCount, _id, _ids) => {
		// Update the data from the server

		if (_id in clients) {
			if (_id != id) {
				console.log('A user disconnected with the id: ' + _id);
				glScene.removeClient(_id);
				removeClientDOMElements(_id);
				clients[_id].peerConnection.destroy();
				delete clients[_id];
			}
		}
	});

	// Update when one of the users moves in space
	socket.on('userPositions', _clientProps => {
		glScene.updateClientPositions(_clientProps);
	});

	// SimplePeer:
	socket.on("signal", data => {
		console.log("onSignal");
		console.log(clients[data.socket].peerConnection);
		let _id = data.socket;
		let signalData = data.signal;
		let localPeer = clients[_id].peerConnection;

		console.log("Received signaling data from peer with socket ID: " + _id);
		localPeer.signal(signalData)
	});
}



////////////////////////////////////////////////////////////////////////////////
// Clients / WebRTC
////////////////////////////////////////////////////////////////////////////////

// Adds client object with THREE.js object, DOM video object and and an RTC peer connection for each :
async function addClient(_id, _initiator) {
	console.log("Adding client with id " + _id);
	clients[_id] = {};

	clients[_id].mediaStream = await getMedia(localMediaConstraints[0]) // start with okay quality

	// add peerConnection to the client
	let sp = createSimplePeer(_id, _initiator);
	clients[_id].peerConnection = sp;

	// add client to scene:
	glScene.addClient(_id);
}


function createSimplePeer(_id, _initiator) {
	// let sp = new SimplePeer({ initiator: _initiator, stream: localMediaStream });
	let sp = new SimplePeer({ initiator: _initiator, stream: clients[_id].mediaStream });

	sp.on('signal', signal => {
		socket.emit('signal', {
			signal,
			to: _id
		})
	});

	sp.on('connect', () => {
		sp.send('Hello from peer ' + id);
	});

	sp.on('data', data => {
		console.log('Incoming message: ' + data);
	});

	sp.on('error', (err) => {
		console.log("Error in peer connection with ID: " + _id);
		console.log(err.code);
	})

	// sp.on('stream', stream => {
	// Split incoming stream into two streams: audio for THREE.PositionalAudio and 
	// video for <video> element --> <canvas> --> videoTexture --> videoMaterial for THREE.js
	// https://stackoverflow.com/questions/50984531/threejs-positional-audio-with-webrtc-streams-produces-no-sound

	// 	////////////////////////////////////////////////////////////////////////
	// 	// VIDEO:
	// 	let videoStream = new MediaStream([stream.getVideoTracks()[0]]);
	// 	createOrUpdateClientVideo(_id, videoStream);

	// 	////////////////////////////////////////////////////////////////////////
	// 	// AUDIO: 
	// 	// some streams don't include audio
	// 	let audioTracks = stream.getAudioTracks();
	// 	if (audioTracks.length > 0) {
	// 		let audioStream = new MediaStream([stream.getAudioTracks()[0]]);
	// 		createOrUpdateClientAudio(_id, audioStream);
	// 	}
	// });

	// do it all in track 
	sp.on('track', (track, stream) => {
		// Split incoming stream into two streams: audio for THREE.PositionalAudio and 
		// video for <video> element --> <canvas> --> videoTexture --> videoMaterial for THREE.js
		// https://stackoverflow.com/questions/50984531/threejs-positional-audio-with-webrtc-streams-produces-no-sound

		// VIDEO:
		let videoTracks = stream.getVideoTracks();
		if (videoTracks.length > 0) {
			let videoStream = new MediaStream([stream.getVideoTracks()[0]]);
			createOrUpdateClientVideo(_id, videoStream);
		}

		// AUDIO: 
		let audioTracks = stream.getAudioTracks();
		if (audioTracks.length > 0) {
			let audioStream = new MediaStream([stream.getAudioTracks()[0]]);
			createOrUpdateClientAudio(_id, audioStream);
		}
	});

	return sp;
}



////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// DIY Selective Forwarding Unit Work-In-Progress

// temporarily pause the outgoing stream
// function disableOutgoingStream() {
// 	localMediaStream.getTracks().forEach(track => {
// 		track.enabled = false;
// 	})
// }
// // enable the outgoing stream
// function enableOutgoingStream() {
// 	localMediaStream.getTracks().forEach(track => {
// 		track.enabled = true;
// 	})
// }

// function swapOutgoingStreams(_id, _existingStream, _newStream) {
// 	clients[_id].peerConnection.removeStream(_existingStream)
// 	clients[_id].peerConnection.addStream(_newStream);
// }

// function adjustOutgoingStream(_id, _mediaConstraints){
// 	let audioStream = new MediaStream([stream.getAudioTracks()[0]]);
// }

// function enableOutgoingAudio(_id) {
// 	clients[_id].mediaStream.getAudioTracks().forEach(track => {
// 		track.enabled = true;
// 	})
// }
// function disableOutgoingAudio(_id) {
// 	clients[_id].mediaStream.getAudioTracks().forEach(track => {
// 		track.enabled = false;
// 	})
// }

// https://github.com/feross/simple-peer/issues/606
// function setPeerVideoQuality(_id, qualityLevel) {
// 	let peer = clients[_id].peerConnection;
// 	let existingTrack = clients[_id].mediaStream.getVideoTracks()[0];
// 	let newTrack = localMediaStreams[qualityLevel].getVideoTracks()[0].clone();
// 	peer.replaceTrack(existingTrack, newTrack, clients[_id].mediaStream);
// }

// function enablePeerAudio(_id) {
// 	let peer = clients[_id].peerConnection;
// 	let peerMediaStream = clients[_id].mediaStream;
// 	localMediaStreams[0].getAudioTracks().forEach(track => {
// 		peer.addTrack(track.clone(), peerMediaStream)
// 	})
// }

// function disablePeerAudio(_id) {
// 	let peer = clients[_id].peerConnection;
// 	let peerMediaStream = clients[_id].mediaStream;
// 	peerMediaStream.getAudioTracks().forEach(track => {
// 		peer.removeTrack(track, peerMediaStream);
// 	})
// }


////////////////////////////////////////////////////////////////////////////////
// Three.js
////////////////////////////////////////////////////////////////////////////////

function onPlayerMove() {
	// console.log('Sending movement update to server.');
	socket.emit('move', glScene.getPlayerPosition());
}

function createScene() {
	// initialize three.js scene
	console.log("Creating three.js scene...")
	glScene = new Scene(
		domElement = document.getElementById('gl_context'),
		_width = window.innerWidth,
		_height = window.innerHeight * 0.8,
		clearColor = 'lightblue',
		onPlayerMove);
}

//////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////
// Utilities 🚂

// created <video> element for local mediastream
function createLocalVideoElement() {
	const videoElement = document.createElement("video");
	videoElement.id = "local_video";
	videoElement.autoplay = true;
	videoElement.width = videoWidth;
	videoElement.height = videoHeight;
	videoElement.style = "visibility: hidden;";

	// there seems to be a weird behavior where a muted video 
	// won't autoplay in chrome...  so instead of muting the video, simply make a
	// video only stream for this video element :|
	let videoStream = new MediaStream([localMediaStreams[0].getVideoTracks()[0]]);

	videoElement.srcObject = videoStream;
	document.body.appendChild(videoElement);
}

function createOrUpdateClientVideo(_id, _videoStream) {
	let remoteVideoElement = document.getElementById(_id + "_video");
	if (remoteVideoElement == null) {
		console.log("Creating video element for user with ID: " + _id);
		remoteVideoElement = document.createElement('video');
		remoteVideoElement.id = _id + "_video";
		remoteVideoElement.style = "visibility: hidden;";
		document.body.appendChild(remoteVideoElement);
	}

	// Question: do i need to update video width and height? or is that based on stream...?

	console.log("Updating video source for user with ID: " + _id);
	remoteVideoElement.srcObject = _videoStream
	remoteVideoElement.autoplay = true;
}

function createOrUpdateClientAudio(_id, _audioStream) {
	// Positional Audio Works in Firefox:
	// TODO make this work for updated stream with same positional audio object:
	// glScene.createOrUpdatePositionalAudio(_id, audioStream); // TODO make this function
	// let audioSource = new THREE.PositionalAudio(glScene.listener);
	// audioSource.setMediaStreamSource(audioStream);
	// audioSource.setRefDistance(10);
	// audioSource.setRolloffFactor(10);
	// clients[_id].group.add(audioSource);

	// Global Audio:
	let remoteAudioElement = document.getElementById(_id + "_audio");
	if (remoteAudioElement == null) {
		console.log("Creating audio element for user with ID: " + _id);
		remoteAudioElement = document.createElement('audio');
		remoteAudioElement.id = _id + "_audio";
		document.body.appendChild(remoteAudioElement);
	}

	console.log("Updating <audio> source object for client with ID: " + _id);
	remoteAudioElement.srcObject = _audioStream;
	remoteAudioElement.play();
	// remoteAudioElement.controls = 'controls'; // if we want to do a sanity-check, this makes the html object visible
	// remoteAudioElement.volume = 1;
}

// remove <video> element and corresponding <canvas> using client ID
function removeClientDOMElements(_id) {
	console.log("Removing DOM elements for client with ID: " + _id);

	let videoEl = document.getElementById(_id + "_video");
	if (videoEl != null) { videoEl.remove(); }
	let canvasEl = document.getElementById(_id + "_canvas");
	if (canvasEl != null) { canvasEl.remove(); }
	let audioEl = document.getElementById(_id + "_audio");
	if (audioEl != null) { audioEl.remove(); }
}
