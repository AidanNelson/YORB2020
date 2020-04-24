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


// IMPORTS
import Scene from './scene';

var SimplePeer = require('simple-peer')

// const mediasoup = require('mediasoup-client');
const socketClient = require('socket.io-client');
// const socketPromise = require('./libs/socket.io-promise').promise;
// const config = require('../config');
const hostname = window.location.hostname;



import * as config from '../config';
import * as mediasoup from 'mediasoup-client';
import deepEqual from 'deep-equal';
import debugModule from 'debug';

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);
const log = debugModule('demo-app');
const warn = debugModule('demo-app:WARN');
const err = debugModule('demo-app:ERROR');


function setupButtons() {
	const joinButton = document.getElementById('join-button');
	const sendCameraButton = document.getElementById('send-camera');
	const stopStreamsButton = document.getElementById('stop-streams');
	const startScreenshareButton = document.getElementById('share-screen');
	const leaveRoomButton = document.getElementById('leave-room');


	joinButton.addEventListener('click', joinRoom);
	sendCameraButton.addEventListener('click', sendCameraStreams);
	stopStreamsButton.addEventListener('click', stopStreams);
	startScreenshareButton.addEventListener('click', startScreenshare);
	leaveRoomButton.addEventListener('click', leaveRoom);
}



//
// export all the references we use internally to manage call state,
// to make it easy to tinker from the js console. for example:
//
//   `Client.camVideoProducer.paused`
//
export let myPeerId = uuidv4();
let allPeers = {};
//
// for each peer that connects, we keep a table of peers and what
// tracks are being sent and received. we also need to know the last
// time we saw the peer, so that we can disconnect clients that have
// network issues.
//
// for this simple demo, each client polls the server at 1hz, and we
// just send this roomState.peers data structure as our answer to each
// poll request.
//
// [peerId] : {
//   joinTs: <ms timestamp>
//   lastSeenTs: <ms timestamp>
//   media: {
//     [mediaTag] : {
//       paused: <bool>
//       encodings: []
//     }
//   },
//   gameStats: {},
//   stats: {
//     producers: {
//       [producerId]: {
//         ...(selected producer stats)
//       }
//     consumers: {
//       [consumerId]: { ...(selected consumer stats) }
//     }
//   }
//   consumerLayers: {
//     [consumerId]:
//         currentLayer,
//         clientSelectedLayer,
//       }
//     }
//   }
// }
//


// export so we can access from JS console
export let mySocketID,
	socket,
	device,
	joined,
	localCam,
	localScreen,
	recvTransport,
	sendTransport,
	camVideoProducer,
	camAudioProducer,
	screenVideoProducer,
	screenAudioProducer,
	currentActiveSpeaker = {},
	lastPollSyncData = {},
	consumers = [],
	pollingInterval;

const serverURL = `https://${hostname}:${config.listenPort}`;


// array of connected clients
let clients = {};

// Variable to store our three.js scene:
let glScene;

// WebRTC Variables:
let iceServerList;

// set video width / height / framerate here:
const videoWidth = 160;
const videoHeight = 120;

// an array of media streams each with different constraints
let localMediaStreams = [];
let gotMediaAccess = false;

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
			frameRate: 10
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

//
// entry point -- called by document.body.onload
//


// export async function main() {
window.onload = async () => {
	console.log("Window loaded.");

	setupButtons();

	console.log(`starting up ... my peerId is ${myPeerId}`);

	try {
		device = new mediasoup.Device();
	} catch (e) {
		if (e.name === 'UnsupportedError') {
			console.error('browser not supported for video calls');
			return;
		} else {
			console.error(e);
		}
	}

	createOrUpdateClientVideo("local", null);

	// first get user media
	localMediaStreams = await getLocalMediaStreams(localMediaConstraints);

	if (gotMediaAccess) {
		createOrUpdateClientVideo("local", localMediaStreams[0]);
	}

	// finally create the threejs scene
	createScene();

	// then initialize socket connection
	await initSocketConnection();


	joinRoom();
	sendCameraStreams();
	// use sendBeacon to tell the server we're disconnecting when
	// the page unloads
	window.addEventListener('unload', () => sig('leave', {}, true));
}



async function init() {
	console.log("Window loaded.");

	createOrUpdateClientVideo("local", null);

	// first get user media
	localMediaStreams = await getLocalMediaStreams(localMediaConstraints);

	if (gotMediaAccess) {
		createOrUpdateClientVideo("local", localMediaStreams[0]);
	}


	// finally create the threejs scene
	createScene();
	// then initialize socket connection
	await initSocketConnection();

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
		} catch (err) {
			console.log("Failed to get user media!");
			console.warn(err);
			return;
		}
	}
	gotMediaAccess = true;
	return streams;
}

////////////////////////////////////////////////////////////////////////////////
// Socket.io
////////////////////////////////////////////////////////////////////////////////

// establishes socket connection
function initSocketConnection() {
	return new Promise(resolve => {

		console.log("Initializing socket.io...");
		socket = io();

		socket.on('connect', () => { });

		//On connection server sends the client his ID and a list of all keys
		// socket.on('introduction', (_id, _clientNum, _ids, _iceServers) => {
		socket.on('introduction', (_id) => {

			// keep local copy of ice servers:
			// console.log("Received ICE server credentials from server.");
			// iceServerList = _iceServers;

			// keep a local copy of my ID:
			console.log('My socket ID is: ' + _id);
			mySocketID = _id;
			myPeerId = _id;
			resolve();
			// socket.emit('updateUUID', myPeerId);

			// for each existing user, add them as a client and add tracks to their peer connection
			// for (let i = 0; i < _ids.length; i++) {
			// 	if (_ids[i] != mySocketID) {
			// 		addClient(_ids[i], true);
			// 	}
			// }
		});

		// when a new user has entered the server
		// socket.on('newUserConnected', (clientCount, _id, _ids) => {
		// 	console.log(clientCount + ' clients connected');

		// 	let alreadyHasUser = false;
		// 	for (let i = 0; i < Object.keys(clients).length; i++) {
		// 		if (Object.keys(clients)[i] == _id) {
		// 			alreadyHasUser = true;
		// 			break;
		// 		}
		// 	}

		// 	if (_id != mySocketID && !alreadyHasUser) {
		// 		console.log('A new user connected with the id: ' + _id);
		// 		addClient(_id, false);
		// 	}

		// });

		// socket.on('userDisconnected', (clientCount, _id, _ids) => {
		// 	// Update the data from the server

		// 	if (_id in clients) {
		// 		if (_id != mySocketID) {
		// 			console.log('A user disconnected with the id: ' + _id);
		// 			glScene.removeClient(_id);
		// 			removeClientDOMElements(_id);
		// 			clients[_id].peerConnection.destroy();
		// 			delete clients[_id];
		// 		}
		// 	}
		// });

		// Update when one of the users moves in space
		// socket.on('userPositions', _clientProps => {
		// 	console.log(_clientProps);
		// 	glScene.updateClientPositions(_clientProps);

		// });

		// SimplePeer:
		// socket.on("signal", data => {
		// 	let _id = data.socket;
		// 	let signalData = data.signal;
		// 	let localPeer = clients[_id].peerConnection;

		// 	console.log("Received signaling data from peer with socket ID: " + _id);
		// 	localPeer.signal(signalData)
		// });
		
	});

}



////////////////////////////////////////////////////////////////////////////////
// Clients / WebRTC
////////////////////////////////////////////////////////////////////////////////


// Adds client object with THREE.js object, DOM video object and and an RTC peer connection for each :
async function addClient(_id, _initiator) {
	console.log("Adding client with id " + _id);
	clients[_id] = {};

	// clients[_id].mediaStream = await getMedia(localMediaConstraints[0]) // start with okay quality
	// if (gotMediaAccess) {
	// 	clients[_id].mediaStream = localMediaStreams[0];
	// }

	// add peerConnection to the client
	// let sp = createSimplePeer(_id, _initiator);
	// clients[_id].peerConnection = sp;

	// add client to scene:
	glScene.addClient(_id);
}


// function createSimplePeer(_id, _initiator) {
// 	let simplePeerOptions = {
// 		initiator: _initiator
// 	}

// 	if (gotMediaAccess) {
// 		simplePeerOptions.stream = clients[_id].mediaStream;
// 	}

// 	let sp = new SimplePeer(simplePeerOptions);


// 	sp.on('signal', signal => {
// 		socket.emit('signal', {
// 			signal,
// 			to: _id
// 		})
// 	});

// 	sp.on('connect', () => {
// 		sp.send('Hello from peer ' + mySocketID);
// 	});

// 	sp.on('data', data => {
// 		console.log('Incoming message: ' + data);
// 	});

// 	sp.on('error', (err) => {
// 		console.log("Error in peer connection with ID: " + _id);
// 		console.log(err.code);
// 	})

// 	sp.on('stream', stream => {
// 		// Split incoming stream into two streams: audio for THREE.PositionalAudio and 
// 		// video for <video> element --> <canvas> --> videoTexture --> videoMaterial for THREE.js
// 		// https://stackoverflow.com/questions/50984531/threejs-positional-audio-with-webrtc-streams-produces-no-sound

// 		// VIDEO:
// 		let videoTracks = stream.getVideoTracks();
// 		if (videoTracks.length > 0) {
// 			let videoStream = new MediaStream([stream.getVideoTracks()[0]]);
// 			createOrUpdateClientVideo(_id, videoStream);
// 		}

// 		// AUDIO: 
// 		let audioTracks = stream.getAudioTracks();
// 		if (audioTracks.length > 0) {
// 			let audioStream = new MediaStream([stream.getAudioTracks()[0]]);
// 			createOrUpdateClientAudio(_id, audioStream);
// 		}
// 	});

// 	// do it all in track 
// 	sp.on('track', (track, stream) => {
// 		// Split incoming stream into two streams: audio for THREE.PositionalAudio and 
// 		// video for <video> element --> <canvas> --> videoTexture --> videoMaterial for THREE.js
// 		// https://stackoverflow.com/questions/50984531/threejs-positional-audio-with-webrtc-streams-produces-no-sound

// 		// VIDEO:
// 		let videoTracks = stream.getVideoTracks();
// 		if (videoTracks.length > 0) {
// 			let videoStream = new MediaStream([stream.getVideoTracks()[0]]);
// 			createOrUpdateClientVideo(_id, videoStream);
// 		}

// 		// AUDIO: 
// 		let audioTracks = stream.getAudioTracks();
// 		if (audioTracks.length > 0) {
// 			let audioStream = new MediaStream([stream.getAudioTracks()[0]]);
// 			createOrUpdateClientAudio(_id, audioStream);
// 		}
// 	});

// 	return sp;
// }



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
////////////////////////////////////////////////////////////////////////////////
// Three.js 🌻

function onPlayerMove() {
	// console.log('Sending movement update to server.');
	socket.emit('move', {
		id: myPeerId,
		data: glScene.getPlayerPosition()
	});
}

function createScene() {
	// initialize three.js scene
	console.log("Creating three.js scene...")

	glScene = new Scene(
		document.getElementById('gl_context'),
		window.innerWidth * 0.5,
		window.innerHeight * 0.5,
		'lightblue',
		onPlayerMove,
		clients,
		allPeers);
}

//////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////
// Utilities 🚂

function createOrUpdateClientVideo(_id, _videoStream) {
	let videoEl = document.getElementById(_id + "_video");
	if (videoEl == null) {
		console.log("Creating video element for user with ID: " + _id);
		videoEl = document.createElement('video');
		videoEl.id = _id + "_video";
		videoEl.style = "visibility: hidden;";
		document.body.appendChild(videoEl);
	}

	// Question: do i need to update video width and height? or is that based on stream...?

	console.log("Updating video source for user with ID: " + _id);
	if (_videoStream != null) {
		videoEl.srcObject = _videoStream
	}
	videoEl.autoplay = true;
}

// TODO positional audio in chrome with adjustment of volume...? 
function createOrUpdateClientAudio(_id, _audioStream) {
	// Positional Audio Works in Firefox:
	// glScene.createOrUpdatePositionalAudio(_id, audioStream); // TODO make this function

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










//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// Mediasoup Code: 


//
// meeting control actions
//

export async function joinRoom() {
	if (joined) {
		return;
	}

	log('join room');
	// $('#join-control').style.display = 'none';

	try {
		// signal that we're a new peer and initialize our
		// mediasoup-client device, if this is our first time connecting
		let { routerRtpCapabilities } = await sig('join-as-new-peer');
		if (!device.loaded) {
			await device.load({ routerRtpCapabilities });
		}
		joined = true;
		// $('#leave-room').style.display = 'initial';
	} catch (e) {
		console.error(e);
		return;
	}

	// super-simple signaling: let's poll at 1-second intervals
	pollingInterval = setInterval(async () => {
		let { error } = await pollAndUpdate();
		if (error) {
			clearInterval(pollingInterval);
			err(error);
		}
	}, 1000);
}

export async function sendCameraStreams() {
	log('send camera streams');
	$('#send-camera').style.display = 'none';

	// make sure we've joined the room and started our camera. these
	// functions don't do anything if they've already been called this
	// session
	await joinRoom();
	await startCamera();

	// create a transport for outgoing media, if we don't already have one
	if (!sendTransport) {
		sendTransport = await createTransport('send');
	}

	// start sending video. the transport logic will initiate a
	// signaling conversation with the server to set up an outbound rtp
	// stream for the camera video track. our createTransport() function
	// includes logic to tell the server to start the stream in a paused
	// state, if the checkbox in our UI is unchecked. so as soon as we
	// have a client-side camVideoProducer object, we need to set it to
	// paused as appropriate, too.
	camVideoProducer = await sendTransport.produce({
		track: localCam.getVideoTracks()[0],
		encodings: camEncodings(),
		appData: { mediaTag: 'cam-video' }
	});
	if (getCamPausedState()) {
		try {
			await camVideoProducer.pause();
		} catch (e) {
			console.error(e);
		}
	}

	// same thing for audio, but we can use our already-created
	camAudioProducer = await sendTransport.produce({
		track: localCam.getAudioTracks()[0],
		appData: { mediaTag: 'cam-audio' }
	});
	if (getMicPausedState()) {
		try {
			camAudioProducer.pause();
		} catch (e) {
			console.error(e);
		}
	}

	$('#stop-streams').style.display = 'initial';
	showCameraInfo();
}

export async function startScreenshare() {
	log('start screen share');
	$('#share-screen').style.display = 'none';

	// make sure we've joined the room and that we have a sending
	// transport
	await joinRoom();
	if (!sendTransport) {
		sendTransport = await createTransport('send');
	}

	// get a screen share track
	localScreen = await navigator.mediaDevices.getDisplayMedia({
		video: true,
		audio: true
	});

	// create a producer for video
	screenVideoProducer = await sendTransport.produce({
		track: localScreen.getVideoTracks()[0],
		encodings: screenshareEncodings(),
		appData: { mediaTag: 'screen-video' }
	});

	// create a producer for audio, if we have it
	if (localScreen.getAudioTracks().length) {
		screenAudioProducer = await sendTransport.produce({
			track: localScreen.getAudioTracks()[0],
			appData: { mediaTag: 'screen-audio' }
		});
	}

	// handler for screen share stopped event (triggered by the
	// browser's built-in screen sharing ui)
	screenVideoProducer.track.onended = async () => {
		log('screen share stopped');
		try {
			await screenVideoProducer.pause();
			let { error } = await sig('close-producer',
				{ producerId: screenVideoProducer.id });
			await screenVideoProducer.close();
			screenVideoProducer = null;
			if (error) {
				err(error);
			}
			if (screenAudioProducer) {
				let { error } = await sig('close-producer',
					{ producerId: screenAudioProducer.id });
				await screenAudioProducer.close();
				screenAudioProducer = null;
				if (error) {
					err(error);
				}
			}
		} catch (e) {
			console.error(e);
		}
		$('#local-screen-pause-ctrl').style.display = 'none';
		$('#local-screen-audio-pause-ctrl').style.display = 'none';
		$('#share-screen').style.display = 'initial';
	}

	$('#local-screen-pause-ctrl').style.display = 'block';
	if (screenAudioProducer) {
		$('#local-screen-audio-pause-ctrl').style.display = 'block';
	}
}

export async function startCamera() {
	if (localCam) {
		return;
	}
	log('start camera');
	try {
		localCam = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: true
		});
	} catch (e) {
		console.error('start camera error', e);
	}
}

// switch to sending video from the "next" camera device in our device
// list (if we have multiple cameras)
export async function cycleCamera() {
	if (!(camVideoProducer && camVideoProducer.track)) {
		warn('cannot cycle camera - no current camera track');
		return;
	}

	log('cycle camera');

	// find "next" device in device list
	let deviceId = await getCurrentDeviceId(),
		allDevices = await navigator.mediaDevices.enumerateDevices(),
		vidDevices = allDevices.filter((d) => d.kind === 'videoinput');
	if (!vidDevices.length > 1) {
		warn('cannot cycle camera - only one camera');
		return;
	}
	let idx = vidDevices.findIndex((d) => d.deviceId === deviceId);
	if (idx === (vidDevices.length - 1)) {
		idx = 0;
	} else {
		idx += 1;
	}

	// get a new video stream. might as well get a new audio stream too,
	// just in case browsers want to group audio/video streams together
	// from the same device when possible (though they don't seem to,
	// currently)
	log('getting a video stream from new device', vidDevices[idx].label);
	localCam = await navigator.mediaDevices.getUserMedia({
		video: { deviceId: { exact: vidDevices[idx].deviceId } },
		audio: true
	});

	// replace the tracks we are sending
	await camVideoProducer.replaceTrack({ track: localCam.getVideoTracks()[0] });
	await camAudioProducer.replaceTrack({ track: localCam.getAudioTracks()[0] });

	// update the user interface
	showCameraInfo();
}

export async function stopStreams() {
	if (!(localCam || localScreen)) {
		return;
	}
	if (!sendTransport) {
		return;
	}

	log('stop sending media streams');
	$('#stop-streams').style.display = 'none';

	let { error } = await sig('close-transport',
		{ transportId: sendTransport.id });
	if (error) {
		err(error);
	}
	// closing the sendTransport closes all associated producers. when
	// the camVideoProducer and camAudioProducer are closed,
	// mediasoup-client stops the local cam tracks, so we don't need to
	// do anything except set all our local variables to null.
	try {
		await sendTransport.close();
	} catch (e) {
		console.error(e);
	}
	sendTransport = null;
	camVideoProducer = null;
	camAudioProducer = null;
	screenVideoProducer = null;
	screenAudioProducer = null;
	localCam = null;
	localScreen = null;

	// update relevant ui elements
	$('#send-camera').style.display = 'initial';
	$('#share-screen').style.display = 'initial';
	$('#local-screen-pause-ctrl').style.display = 'none';
	$('#local-screen-audio-pause-ctrl').style.display = 'none';
	showCameraInfo();
}

export async function leaveRoom() {
	if (!joined) {
		return;
	}

	log('leave room');
	$('#leave-room').style.display = 'none';

	// stop polling
	clearInterval(pollingInterval);

	// close everything on the server-side (transports, producers, consumers)
	let { error } = await sig('leave');
	if (error) {
		err(error);
	}

	// closing the transports closes all producers and consumers. we
	// don't need to do anything beyond closing the transports, except
	// to set all our local variables to their initial states
	try {
		recvTransport && await recvTransport.close();
		sendTransport && await sendTransport.close();
	} catch (e) {
		console.error(e);
	}
	recvTransport = null;
	sendTransport = null;
	camVideoProducer = null;
	camAudioProducer = null;
	screenVideoProducer = null;
	screenAudioProducer = null;
	localCam = null;
	localScreen = null;
	lastPollSyncData = {};
	consumers = [];
	joined = false;

	// hacktastically restore ui to initial state
	$('#join-control').style.display = 'initial';
	$('#send-camera').style.display = 'initial';
	$('#stop-streams').style.display = 'none';
	$('#remote-video').innerHTML = '';
	$('#share-screen').style.display = 'initial';
	$('#local-screen-pause-ctrl').style.display = 'none';
	$('#local-screen-audio-pause-ctrl').style.display = 'none';
	showCameraInfo();
	updateCamVideoProducerStatsDisplay();
	updateScreenVideoProducerStatsDisplay();
	updatePeersDisplay();
}

export async function subscribeToTrack(peerId, mediaTag) {
	log('subscribe to track', peerId, mediaTag);

	// create a receive transport if we don't already have one
	if (!recvTransport) {
		recvTransport = await createTransport('recv');
	}

	// if we do already have a consumer, we shouldn't have called this
	// method
	let consumer = findConsumerForTrack(peerId, mediaTag);
	if (consumer) {
		err('already have consumer for track', peerId, mediaTag)
		return;
	};

	// ask the server to create a server-side consumer object and send
	// us back the info we need to create a client-side consumer
	let consumerParameters = await sig('recv-track', {
		mediaTag,
		mediaPeerId: peerId,
		rtpCapabilities: device.rtpCapabilities
	});
	log('consumer parameters', consumerParameters);
	consumer = await recvTransport.consume({
		...consumerParameters,
		appData: { peerId, mediaTag }
	});
	log('created new consumer', consumer.id);

	// the server-side consumer will be started in paused state. wait
	// until we're connected, then send a resume request to the server
	// to get our first keyframe and start displaying video
	while (recvTransport.connectionState !== 'connected') {
		log('  transport connstate', recvTransport.connectionState);
		await sleep(100);
	}
	// okay, we're ready. let's ask the peer to send us media
	await resumeConsumer(consumer);

	// keep track of all our consumers
	consumers.push(consumer);

	// ui
	await addVideoAudio(consumer);
	updatePeersDisplay();
}

export async function unsubscribeFromTrack(peerId, mediaTag) {
	let consumer = findConsumerForTrack(peerId, mediaTag);
	if (!consumer) {
		return;
	}

	log('unsubscribe from track', peerId, mediaTag);
	try {
		await closeConsumer(consumer);
	} catch (e) {
		console.error(e);
	}
	// force update of ui
	updatePeersDisplay();
}

export async function pauseConsumer(consumer) {
	if (consumer) {
		log('pause consumer', consumer.appData.peerId, consumer.appData.mediaTag);
		try {
			await sig('pause-consumer', { consumerId: consumer.id });
			await consumer.pause();
		} catch (e) {
			console.error(e);
		}
	}
}

export async function resumeConsumer(consumer) {
	if (consumer) {
		log('resume consumer', consumer.appData.peerId, consumer.appData.mediaTag);
		try {
			await sig('resume-consumer', { consumerId: consumer.id });
			await consumer.resume();
		} catch (e) {
			console.error(e);
		}
	}
}

export async function pauseProducer(producer) {
	if (producer) {
		log('pause producer', producer.appData.mediaTag);
		try {
			await sig('pause-producer', { producerId: producer.id });
			await producer.pause();
		} catch (e) {
			console.error(e);
		}
	}
}

export async function resumeProducer(producer) {
	if (producer) {
		log('resume producer', producer.appData.mediaTag);
		try {
			await sig('resume-producer', { producerId: producer.id });
			await producer.resume();
		} catch (e) {
			console.error(e);
		}
	}
}

async function closeConsumer(consumer) {
	if (!consumer) {
		return;
	}
	log('closing consumer', consumer.appData.peerId, consumer.appData.mediaTag);
	try {
		// tell the server we're closing this consumer. (the server-side
		// consumer may have been closed already, but that's okay.)
		await sig('close-consumer', { consumerId: consumer.id });
		await consumer.close();

		consumers = consumers.filter((c) => c !== consumer);
		removeVideoAudio(consumer);
	} catch (e) {
		console.error(e);
	}
}

// utility function to create a transport and hook up signaling logic
// appropriate to the transport's direction
//
async function createTransport(direction) {
	log(`create ${direction} transport`);

	// ask the server to create a server-side transport object and send
	// us back the info we need to create a client-side transport
	let transport,
		{ transportOptions } = await sig('create-transport', { direction });
	log('transport options', transportOptions);

	if (direction === 'recv') {
		transport = await device.createRecvTransport(transportOptions);
	} else if (direction === 'send') {
		transport = await device.createSendTransport(transportOptions);
	} else {
		throw new Error(`bad transport 'direction': ${direction}`);
	}

	// mediasoup-client will emit a connect event when media needs to
	// start flowing for the first time. send dtlsParameters to the
	// server, then call callback() on success or errback() on failure.
	transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
		log('transport connect event', direction);
		let { error } = await sig('connect-transport', {
			transportId: transportOptions.id,
			dtlsParameters
		});
		if (error) {
			err('error connecting transport', direction, error);
			errback();
			return;
		}
		callback();
	});

	if (direction === 'send') {
		// sending transports will emit a produce event when a new track
		// needs to be set up to start sending. the producer's appData is
		// passed as a parameter
		transport.on('produce', async ({ kind, rtpParameters, appData },
			callback, errback) => {
			log('transport produce event', appData.mediaTag);
			// we may want to start out paused (if the checkboxes in the ui
			// aren't checked, for each media type. not very clean code, here
			// but, you know, this isn't a real application.)
			let paused = false;
			if (appData.mediaTag === 'cam-video') {
				paused = getCamPausedState();
			} else if (appData.mediaTag === 'cam-audio') {
				paused = getMicPausedState();
			}
			// tell the server what it needs to know from us in order to set
			// up a server-side producer object, and get back a
			// producer.id. call callback() on success or errback() on
			// failure.
			let { error, id } = await sig('send-track', {
				transportId: transportOptions.id,
				kind,
				rtpParameters,
				paused,
				appData
			});
			if (error) {
				err('error setting up server-side producer', error);
				errback();
				return;
			}
			callback({ id });
		});
	}

	// for this simple demo, any time a transport transitions to closed,
	// failed, or disconnected, leave the room and reset
	//
	transport.on('connectionstatechange', async (state) => {
		log(`transport ${transport.id} connectionstatechange ${state}`);
		// for this simple sample code, assume that transports being
		// closed is an error (we never close these transports except when
		// we leave the room)
		if (state === 'closed' || state === 'failed' || state === 'disconnected') {
			log('transport closed ... leaving the room and resetting');
			leaveRoom();
		}
	});

	return transport;
}

//
// polling/update logic
//

async function pollAndUpdate() {
	let { peers, activeSpeaker, error } = await sig('sync');
	console.log("_________PEERS_________");
	console.log(peers);
	allPeers = peers;
	if (error) {
		return ({ error });
	}

	// always update bandwidth stats and active speaker display
	currentActiveSpeaker = activeSpeaker;
	updateActiveSpeaker();
	updateCamVideoProducerStatsDisplay();
	updateScreenVideoProducerStatsDisplay();
	updateConsumersStatsDisplay();

	// decide if we need to update tracks list and video/audio
	// elements. build list of peers, sorted by join time, removing last
	// seen time and stats, so we can easily do a deep-equals
	// comparison. compare this list with the cached list from last
	// poll.
	let thisPeersList = sortPeers(peers),
		lastPeersList = sortPeers(lastPollSyncData);
	if (!deepEqual(thisPeersList, lastPeersList)) {
		updatePeersDisplay(peers, thisPeersList);
	}

	// if a peer has gone away, we need to close all consumers we have
	// for that peer and remove video and audio elements
	for (let id in lastPollSyncData) {
		if (!peers[id]) {
			log(`peer ${id} has exited`);
			consumers.forEach((consumer) => {
				if (consumer.appData.peerId === id) {
					closeConsumer(consumer);
				}
			});
		}
	}

	// if a peer has stopped sending media that we are consuming, we
	// need to close the consumer and remove video and audio elements
	consumers.forEach((consumer) => {
		let { peerId, mediaTag } = consumer.appData;
		if (!peers[peerId].media[mediaTag]) {
			log(`peer ${peerId} has stopped transmitting ${mediaTag}`);
			closeConsumer(consumer);
		}
	});

	lastPollSyncData = peers;
	console.log(peers);
	return ({}); // return an empty object if there isn't an error
}

function sortPeers(peers) {
	return Object.entries(peers)
		.map(([id, info]) => ({ id, joinTs: info.joinTs, media: { ...info.media } }))
		.sort((a, b) => (a.joinTs > b.joinTs) ? 1 : ((b.joinTs > a.joinTs) ? -1 : 0));
}

function findConsumerForTrack(peerId, mediaTag) {
	return consumers.find((c) => (c.appData.peerId === peerId &&
		c.appData.mediaTag === mediaTag));
}

//
// -- user interface --
//

export function getCamPausedState() {
	return !$('#local-cam-checkbox').checked;
}

export function getMicPausedState() {
	return !$('#local-mic-checkbox').checked;
}

export function getScreenPausedState() {
	return !$('#local-screen-checkbox').checked;
}

export function getScreenAudioPausedState() {
	return !$('#local-screen-audio-checkbox').checked;
}

export async function changeCamPaused() {
	if (getCamPausedState()) {
		pauseProducer(camVideoProducer);
		$('#local-cam-label').innerHTML = 'camera (paused)';
	} else {
		resumeProducer(camVideoProducer);
		$('#local-cam-label').innerHTML = 'camera';
	}
}

export async function changeMicPaused() {
	if (getMicPausedState()) {
		pauseProducer(camAudioProducer);
		$('#local-mic-label').innerHTML = 'mic (paused)';
	} else {
		resumeProducer(camAudioProducer);
		$('#local-mic-label').innerHTML = 'mic';
	}
}

export async function changeScreenPaused() {
	if (getScreenPausedState()) {
		pauseProducer(screenVideoProducer);
		$('#local-screen-label').innerHTML = 'screen (paused)';
	} else {
		resumeProducer(screenVideoProducer);
		$('#local-screen-label').innerHTML = 'screen';
	}
}

export async function changeScreenAudioPaused() {
	if (getScreenAudioPausedState()) {
		pauseProducer(screenAudioProducer);
		$('#local-screen-audio-label').innerHTML = 'screen (paused)';
	} else {
		resumeProducer(screenAudioProducer);
		$('#local-screen-audio-label').innerHTML = 'screen';
	}
}


export async function updatePeersDisplay(peersInfo = lastPollSyncData,
	sortedPeers = sortPeers(peersInfo)) {
	log('room state updated', peersInfo);

	$('#available-tracks').innerHTML = '';
	if (camVideoProducer) {
		$('#available-tracks')
			.appendChild(makeTrackControlEl('my', 'cam-video',
				peersInfo[myPeerId].media['cam-video']));
	}
	if (camAudioProducer) {
		$('#available-tracks')
			.appendChild(makeTrackControlEl('my', 'cam-audio',
				peersInfo[myPeerId].media['cam-audio']));
	}
	if (screenVideoProducer) {
		$('#available-tracks')
			.appendChild(makeTrackControlEl('my', 'screen-video',
				peersInfo[myPeerId].media['screen-video']));
	}
	if (screenAudioProducer) {
		$('#available-tracks')
			.appendChild(makeTrackControlEl('my', 'screen-audio',
				peersInfo[myPeerId].media['screen-audio']));
	}

	for (let peer of sortedPeers) {
		if (peer.id === myPeerId) {
			continue;
		}
		for (let [mediaTag, info] of Object.entries(peer.media)) {
			$('#available-tracks')
				.appendChild(makeTrackControlEl(peer.id, mediaTag, info));
			if (peer.id in lastPollSyncData){
				console.log("Adding peer with id: " + peer.id);
				glScene.addClient(peer.id);
			}
		}
	}
}

function makeTrackControlEl(peerName, mediaTag, mediaInfo) {
	let div = document.createElement('div'),
		peerId = (peerName === 'my' ? myPeerId : peerName),
		consumer = findConsumerForTrack(peerId, mediaTag);
	div.classList = `track-subscribe track-subscribe-${peerId}`;

	let sub = document.createElement('button');
	if (!consumer) {
		sub.innerHTML += 'subscribe'
		sub.onclick = () => subscribeToTrack(peerId, mediaTag);
		div.appendChild(sub);

	} else {
		sub.innerHTML += 'unsubscribe'
		sub.onclick = () => unsubscribeFromTrack(peerId, mediaTag);
		div.appendChild(sub);
	}

	let trackDescription = document.createElement('span');
	trackDescription.innerHTML = `${peerName} ${mediaTag}`
	div.appendChild(trackDescription);

	try {
		if (mediaInfo) {
			let producerPaused = mediaInfo.paused;
			let prodPauseInfo = document.createElement('span');
			prodPauseInfo.innerHTML = producerPaused ? '[producer paused]'
				: '[producer playing]';
			div.appendChild(prodPauseInfo);
		}
	} catch (e) {
		console.error(e);
	}

	if (consumer) {
		let pause = document.createElement('span'),
			checkbox = document.createElement('input'),
			label = document.createElement('label');
		pause.classList = 'nowrap';
		checkbox.type = 'checkbox';
		checkbox.checked = !consumer.paused;
		checkbox.onchange = async () => {
			if (checkbox.checked) {
				await resumeConsumer(consumer);
			} else {
				await pauseConsumer(consumer);
			}
			updatePeersDisplay();
		}
		label.id = `consumer-stats-${consumer.id}`;
		if (consumer.paused) {
			label.innerHTML = '[consumer paused]'
		} else {
			let stats = lastPollSyncData[myPeerId].stats[consumer.id],
				bitrate = '-';
			if (stats) {
				bitrate = Math.floor(stats.bitrate / 1000.0);
			}
			label.innerHTML = `[consumer playing ${bitrate} kb/s]`;
		}
		pause.appendChild(checkbox);
		pause.appendChild(label);
		div.appendChild(pause);

		if (consumer.kind === 'video') {
			let remoteProducerInfo = document.createElement('span');
			remoteProducerInfo.classList = 'nowrap track-ctrl';
			remoteProducerInfo.id = `track-ctrl-${consumer.producerId}`;
			div.appendChild(remoteProducerInfo);
		}
	}

	return div;
}

function addVideoAudio(consumer) {
	if (!(consumer && consumer.track)) {
		return;
	}
	let el = document.createElement(consumer.kind);
	// set some attributes on our audio and video elements to make
	// mobile Safari happy. note that for audio to play you need to be
	// capturing from the mic/camera
	if (consumer.kind === 'video') {
		el.setAttribute('playsinline', true);
	} else {
		el.setAttribute('playsinline', true);
		el.setAttribute('autoplay', true);
	}
	el.id = `#remote-${consumer.kind}`;
	document.body.appendChild(el);

	// $(`#remote-${consumer.kind}`).appendChild(el);
	el.srcObject = new MediaStream([consumer.track.clone()]);
	el.consumer = consumer;
	// let's "yield" and return before playing, rather than awaiting on
	// play() succeeding. play() will not succeed on a producer-paused
	// track until the producer unpauses.
	el.play()
		.then(() => { })
		.catch((e) => {
			err(e);
		});
}

function removeVideoAudio(consumer) {
	document.querySelectorAll(consumer.kind).forEach((v) => {
		if (v.consumer === consumer) {
			v.parentNode.removeChild(v);
		}
	});
}

async function showCameraInfo() {
	let deviceId = await getCurrentDeviceId(),
		infoEl = $('#camera-info');
	if (!deviceId) {
		infoEl.innerHTML = '';
		return;
	}
	let devices = await navigator.mediaDevices.enumerateDevices(),
		deviceInfo = devices.find((d) => d.deviceId === deviceId);
	infoEl.innerHTML = `
      ${ deviceInfo.label}
      <button onclick="Client.cycleCamera()">switch camera</button>
  `;
}

export async function getCurrentDeviceId() {
	if (!camVideoProducer) {
		return null;
	}
	let deviceId = camVideoProducer.track.getSettings().deviceId;
	if (deviceId) {
		return deviceId;
	}
	// Firefox doesn't have deviceId in MediaTrackSettings object
	let track = localCam && localCam.getVideoTracks()[0];
	if (!track) {
		return null;
	}
	let devices = await navigator.mediaDevices.enumerateDevices(),
		deviceInfo = devices.find((d) => d.label.startsWith(track.label));
	return deviceInfo.deviceId;
}

function updateActiveSpeaker() {
	$$('.track-subscribe').forEach((el) => {
		el.classList.remove('active-speaker');
	});
	if (currentActiveSpeaker.peerId) {
		$$(`.track-subscribe-${currentActiveSpeaker.peerId}`).forEach((el) => {
			el.classList.add('active-speaker');
		});
	}
}

function updateCamVideoProducerStatsDisplay() {
	let tracksEl = $('#camera-producer-stats');
	tracksEl.innerHTML = '';
	if (!camVideoProducer || camVideoProducer.paused) {
		return;
	}
	makeProducerTrackSelector({
		internalTag: 'local-cam-tracks',
		container: tracksEl,
		peerId: myPeerId,
		producerId: camVideoProducer.id,
		currentLayer: camVideoProducer.maxSpatialLayer,
		layerSwitchFunc: (i) => {
			console.log('client set layers for cam stream');
			camVideoProducer.setMaxSpatialLayer(i)
		}
	});
}

function updateScreenVideoProducerStatsDisplay() {
	let tracksEl = $('#screen-producer-stats');
	tracksEl.innerHTML = '';
	if (!screenVideoProducer || screenVideoProducer.paused) {
		return;
	}
	makeProducerTrackSelector({
		internalTag: 'local-screen-tracks',
		container: tracksEl,
		peerId: myPeerId,
		producerId: screenVideoProducer.id,
		currentLayer: screenVideoProducer.maxSpatialLayer,
		layerSwitchFunc: (i) => {
			console.log('client set layers for screen stream');
			screenVideoProducer.setMaxSpatialLayer(i)
		}
	});
}

function updateConsumersStatsDisplay() {
	try {
		for (let consumer of consumers) {
			let label = $(`#consumer-stats-${consumer.id}`);
			if (label) {
				if (consumer.paused) {
					label.innerHTML = '(consumer paused)'
				} else {
					let stats = lastPollSyncData[myPeerId].stats[consumer.id],
						bitrate = '-';
					if (stats) {
						bitrate = Math.floor(stats.bitrate / 1000.0);
					}
					label.innerHTML = `[consumer playing ${bitrate} kb/s]`;
				}
			}

			let mediaInfo = lastPollSyncData[consumer.appData.peerId] &&
				lastPollSyncData[consumer.appData.peerId]
					.media[consumer.appData.mediaTag];
			if (mediaInfo && !mediaInfo.paused) {
				let tracksEl = $(`#track-ctrl-${consumer.producerId}`);
				if (tracksEl && lastPollSyncData[myPeerId]
					.consumerLayers[consumer.id]) {
					tracksEl.innerHTML = '';
					let currentLayer = lastPollSyncData[myPeerId]
						.consumerLayers[consumer.id].currentLayer;
					makeProducerTrackSelector({
						internalTag: consumer.id,
						container: tracksEl,
						peerId: consumer.appData.peerId,
						producerId: consumer.producerId,
						currentLayer: currentLayer,
						layerSwitchFunc: (i) => {
							console.log('ask server to set layers');
							sig('consumer-set-layers', {
								consumerId: consumer.id,
								spatialLayer: i
							});
						}
					});
				}
			}
		}
	} catch (e) {
		log('error while updating consumers stats display', e);
	}
}

function makeProducerTrackSelector({ internalTag, container, peerId, producerId,
	currentLayer, layerSwitchFunc }) {
	try {
		let pollStats = lastPollSyncData[peerId] &&
			lastPollSyncData[peerId].stats[producerId];
		if (!pollStats) {
			return;
		}

		let stats = [...Array.from(pollStats)]
			.sort((a, b) => a.rid > b.rid ? 1 : (a.rid < b.rid ? -1 : 0));
		let i = 0;
		for (let s of stats) {
			let div = document.createElement('div'),
				radio = document.createElement('input'),
				label = document.createElement('label'),
				x = i;
			radio.type = 'radio';
			radio.name = `radio-${internalTag}-${producerId}`;
			radio.checked = currentLayer == undefined ?
				(i === stats.length - 1) :
				(i === currentLayer);
			radio.onchange = () => layerSwitchFunc(x);
			let bitrate = Math.floor(s.bitrate / 1000);
			label.innerHTML = `${bitrate} kb/s`;
			div.appendChild(radio);
			div.appendChild(label);
			container.appendChild(div);
			i++;
		}
		if (i) {
			let txt = document.createElement('div');
			txt.innerHTML = 'tracks';
			container.insertBefore(txt, container.firstChild);
		}
	} catch (e) {
		log('error while updating track stats display', e);
	}
}

//
// encodings for outgoing video
//

// just two resolutions, for now, as chrome 75 seems to ignore more
// than two encodings
//
const CAM_VIDEO_SIMULCAST_ENCODINGS =
	[
		{ maxBitrate: 96000, scaleResolutionDownBy: 4 },
		{ maxBitrate: 680000, scaleResolutionDownBy: 1 },
	];

function camEncodings() {
	return CAM_VIDEO_SIMULCAST_ENCODINGS;
}

// how do we limit bandwidth for screen share streams?
//
function screenshareEncodings() {
	null;
}

//
// our "signaling" function -- just an http fetch
//

async function sig(endpoint, data, beacon) {
	try {
		let headers = { 'Content-Type': 'application/json' },
			body = JSON.stringify({ ...data, peerId: myPeerId });

		if (beacon) {
			navigator.sendBeacon('/signaling/' + endpoint, body);
			return null;
		}

		let response = await fetch(
			'/signaling/' + endpoint, { method: 'POST', body, headers }
		);
		return await response.json();
	} catch (e) {
		console.error(e);
		return { error: e };
	}
}

//
// simple uuid helper function
//

function uuidv4() {
	return ('111-111-1111').replace(/[018]/g, () =>
		(crypto.getRandomValues(new Uint8Array(1))[0] & 15).toString(16));
}

//
// promisified sleep
//

async function sleep(ms) {
	return new Promise((r) => setTimeout(() => r(), ms));
}
