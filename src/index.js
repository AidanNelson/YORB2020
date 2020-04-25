/* 
* YORB 2020
*
* Aidan Nelson, April 2020
*
*/


//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// IMPORTS
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

import Scene from './scene';

const io = require('socket.io-client');
const socketPromise = require('./libs/socket.io-promise').promise;
const hostname = window.location.hostname;

import * as config from '../config';
import * as mediasoup from 'mediasoup-client';
import debugModule from 'debug';

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

const log = debugModule('demo-app');
const warn = debugModule('demo-app:WARN');
const err = debugModule('demo-app:ERROR');


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
	pollingInterval,
	webcamVideoPaused = false,
	webcamAudioPaused = false,
	screenShareVideoPaused = false,
	screenShareAudioPaused = false,
	clients = {}, // array of connected clients for three.js scene
	glScene; // Variable to store our three.js scene:

// limit video size / framerate for bandwidth or use bandwidth limitation through encoding?
// TODO deal with overconstrained errors?
let localMediaConstraints = {
	audio: {
		echoCancellation: true,
		noiseSuppression: true
	},
	video: true
};


//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// Start-Up Sequence:
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

window.onload = async () => {
	console.log("Window loaded.");
	setupButtons();

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

	createScene();

	// then initialize socket connection
	await initSocketConnection();

	await joinRoom();
	// sendCameraStreams(); // send feeds on user input

	// use sendBeacon to tell the server we're disconnecting when
	// the page unloads
	window.addEventListener('unload', () => {
		socket.request('leave', {});
		// sig('leave', {}, true)
	});
}




//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// Local media stream setup
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

// // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
// async function getLocalMediaStreams(_mediaConstraintsArray) {
// 	let streams = [];
// 	for (let i = 0; i < _mediaConstraintsArray.length; i++) {
// 		let stream = null;
// 		try {
// 			stream = await navigator.mediaDevices.getUserMedia(_mediaConstraintsArray[i]);
// 			streams.push(stream);
// 		} catch (err) {
// 			console.log("Failed to get user media!");
// 			console.warn(err);
// 			return;
// 		}
// 	}
// 	gotMediaAccess = true;
// 	return streams;
// }

//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// Socket.io
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

// establishes socket connection
// uses promise to ensure that we receive our so
function initSocketConnection() {
	return new Promise(resolve => {

		console.log("Initializing socket.io...");
		socket = io();
		socket.request = socketPromise(socket);

		socket.on('connect', () => { });

		//On connection server sends the client his ID and a list of all keys
		socket.on('introduction', (_id, _ids) => {

			// keep a local copy of my ID:
			console.log('My socket ID is: ' + _id);
			mySocketID = _id;

			// for each existing user, add them as a client and add tracks to their peer connection
			for (let i = 0; i < _ids.length; i++) {
				if (_ids[i] != mySocketID) {
					console.log
					addClient(_ids[i]);
				}
			}
			resolve();
		});

		// when a new user has entered the server
		socket.on('newUserConnected', (clientCount, _id, _ids) => {
			console.log(clientCount + ' clients connected');

			if (!(_id in clients)) {
				if (_id != mySocketID) {
					console.log('A new user connected with the id: ' + _id);
					addClient(_id);
				}
			}
		});

		socket.on('userDisconnected', (clientCount, _id, _ids) => {
			// Update the data from the server

			if (_id in clients) {
				if (_id != mySocketID) {
					console.log('A user disconnected with the id: ' + _id);
					glScene.removeClient(_id);
					removeClientDOMElements(_id);
					delete clients[_id];
				}
			}
		});

		// Update when one of the users moves in space
		socket.on('userPositions', _clientProps => {
			glScene.updateClientPositions(_clientProps);
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
	glScene.addClient(_id);
}



//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// Three.js 🌻
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

function onPlayerMove() {
	socket.emit('move', glScene.getPlayerPosition());
}

function createScene() {
	// initialize three.js scene
	console.log("Creating three.js scene...")

	glScene = new Scene(
		document.getElementById('gl_context'),
		(window.innerWidth * 0.9),
		(window.innerHeight * 0.8),
		'lightblue',
		onPlayerMove,
		clients,
		mySocketID);
}

//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
// User Interface 🚂
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//

function setupButtons() {
	// const joinButton = document.getElementById('join-button');
	const sendCameraButton = document.getElementById('send-camera');
	const stopStreamsButton = document.getElementById('stop-streams');
	// const startScreenshareButton = document.getElementById('share-screen');
	// const leaveRoomButton = document.getElementById('leave-room');
	const camPauseRadioButton = document.getElementById('local-cam-checkbox');
	const micPauseRadioButton = document.getElementById('local-mic-checkbox');


	// joinButton.addEventListener('click', joinRoom);
	sendCameraButton.addEventListener('click', sendCameraStreams);
	stopStreamsButton.addEventListener('click', stopStreams);
	// startScreenshareButton.addEventListener('click', startScreenshare);
	// leaveRoomButton.addEventListener('click', leaveRoom);
	camPauseRadioButton.addEventListener('change', toggleWebcamVideoPauseState);
	micPauseRadioButton.addEventListener('change', toggleWebcamAudioPauseState);
}


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
// Mediasoup Code: 
//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//


//
// meeting control actions
//

export async function joinRoom() {
	if (joined) {
		return;
	}
	log('join room');

	try {
		// signal that we're a new peer and initialize our
		// mediasoup-client device, if this is our first time connecting
		let resp = await socket.request('join-as-new-peer');
		let { routerRtpCapabilities } = resp;
		console.log(resp);
		if (!device.loaded) {
			await device.load({ routerRtpCapabilities });
		}
		joined = true;
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

			let { error } = await socket.request('close-producer',
				{ producerId: screenVideoProducer.id });
			await screenVideoProducer.close();
			screenVideoProducer = null;
			if (error) {
				err(error);
			}
			if (screenAudioProducer) {

				let { error } = await socket.request('close-producer',
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
		// $('#local-screen-pause-ctrl').style.display = 'none';
		// $('#local-screen-audio-pause-ctrl').style.display = 'none';
		// $('#share-screen').style.display = 'initial';
	}

	// $('#local-screen-pause-ctrl').style.display = 'block';
	if (screenAudioProducer) {
		// $('#local-screen-audio-pause-ctrl').style.display = 'block';
	}
}

export async function startCamera() {
	if (localCam) {
		return;
	}
	log('start camera');
	try {
		localCam = await navigator.mediaDevices.getUserMedia(localMediaConstraints);
		if (localCam) {
			createOrUpdateClientVideo('local', localCam);
		}
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
}

export async function stopStreams() {
	if (!(localCam || localScreen)) {
		return;
	}
	if (!sendTransport) {
		return;
	}

	log('stop sending media streams');
	// $('#stop-streams').style.display = 'none';

	let { error } = await socket.request('close-transport',
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
}

export async function leaveRoom() {
	if (!joined) {
		return;
	}

	log('leave room');

	// stop polling
	clearInterval(pollingInterval);

	// close everything on the server-side (transports, producers, consumers)
	let { error } = await socket.request('leave');
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

	let consumerParameters = await socket.request('recv-track', {
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
	await addVideoAudio(consumer, peerId);
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
}

export async function pauseConsumer(consumer) {
	if (consumer) {
		log('pause consumer', consumer.appData.peerId, consumer.appData.mediaTag);
		try {
			await socket.request('pause-consumer', { consumerId: consumer.id });
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
			await socket.request('resume-consumer', { consumerId: consumer.id });
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
			await socket.request('pause-producer', { producerId: producer.id });
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
			await socket.request('resume-producer', { producerId: producer.id });

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
		await socket.request('close-consumer', { consumerId: consumer.id });
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
		{ transportOptions } = await socket.request('create-transport', { direction });
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

		let { error } = await socket.request('connect-transport', {
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

			let { error, id } = await socket.request('send-track', {
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
	let { peers, activeSpeaker, error } = await socket.request('sync');

	if (error) {
		return ({ error });
	}

	// always update bandwidth stats and active speaker display
	currentActiveSpeaker = activeSpeaker;

	// decide if we need to update tracks list and video/audio
	// elements. build list of peers, sorted by join time, removing last
	// seen time and stats, so we can easily do a deep-equals
	// comparison. compare this list with the cached list from last
	// poll.

	// if a new peer has connected, auto-subscribe to their feeds:
	// TODO auto subscribe at lowest spatial layer
	for (let id in peers) {
		if (id === mySocketID) {
			continue;
		}
		for (let [mediaTag, info] of Object.entries(peers[id].media)) {
			if (!findConsumerForTrack(id, mediaTag)) {
				log(`auto subscribing to track that ${id} has added`);
				await subscribeToTrack(id, mediaTag);
			}
		}
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
		if (!peers[peerId]) {
			log(`peer ${peerId} has stopped transmitting ${mediaTag}`);
			closeConsumer(consumer);
		} else if (!peers[peerId].media[mediaTag]) {
			log(`peer ${peerId} has stopped transmitting ${mediaTag}`);
			closeConsumer(consumer);
		}
	});

	lastPollSyncData = peers;
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
	return webcamVideoPaused;
}

export function getMicPausedState() {
	return webcamAudioPaused;
}

export function getScreenPausedState() {
	return screenShareVideoPaused;
}

export function getScreenAudioPausedState() {
	return screenShareAudioPaused;
}

export async function toggleWebcamVideoPauseState() {
	if (getCamPausedState()) {
		resumeProducer(camVideoProducer);
	} else {
		pauseProducer(camVideoProducer);
	}
	webcamVideoPaused = !webcamVideoPaused;
}

export async function toggleWebcamAudioPauseState() {
	if (getMicPausedState()) {
		resumeProducer(camAudioProducer);
	} else {
		pauseProducer(camAudioProducer);
	}
	webcamAudioPaused = !webcamAudioPaused;
}

export async function toggleScreenshareVideoPauseState() {
	if (getScreenPausedState()) {
		pauseProducer(screenVideoProducer);

	} else {
		resumeProducer(screenVideoProducer);
	}
	screenShareVideoPaused = !screenShareVideoPaused;
}

export async function toggleScreenshareAudioPauseState() {
	if (getScreenAudioPausedState()) {
		pauseProducer(screenAudioProducer);
	} else {
		resumeProducer(screenAudioProducer);
	}
	screenShareAudioPaused = !screenShareAudioPaused;
}



function addVideoAudio(consumer, peerId) {
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
	el.id = `${peerId}_${consumer.kind}`;
	document.body.appendChild(el);

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
// promisified sleep
//

async function sleep(ms) {
	return new Promise((r) => setTimeout(() => r(), ms));
}
