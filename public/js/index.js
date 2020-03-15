/* 
* YORB 2020
* 
* This uses code from a THREE.js Multiplayer boilerplate made by Or Fleisher:
* https://github.com/juniorxsound/THREE.Multiplayer
* And a WEBRTC chat app made by Mikołaj Wargowski:
* https://github.com/Miczeq22/simple-chat-app
*


TODO:
- add localvideo for head
- add positional audio
	- split incoming peer streams into audio and video
	- send video to video element
	- attach audio stream to three.js audio source
- stress test
- add back in lerping of movement values
*/

//A socket.io instance
const socket = io();

let id;
// let clients = new Object(); // move this to scene.js for hacky reasons


// WEBRTC stuff:
const { RTCPeerConnection, RTCSessionDescription } = window;
let iceServerList;

// set video width / height here:
const videoWidth = 160;
const videoHeight = 120;
const videoFrameRate = 15;

// Get access to local media stream (i.e. webcam and microphone stream)
let stream = null;

// set constraints on local audio/video stream
// is there a better place to do this?
// what should constraints be to allow for many streams...?
let constraints = {
	audio: true,
	video: {
		width: videoWidth,
		height: videoHeight,
		frameRate: videoFrameRate
	}
}



function onPlayerMove() {
	// console.log('Sending movement update to server.');
	socket.emit('move', glScene.getPlayerPosition());

}

// initialize three.js scene
let glScene = new Scene(
	domElement = document.getElementById('gl_context'),
	_width = window.innerWidth,
	_height = 400,
	hasControls = true,
	clearColor = 'lightblue',
	onPlayerMove);







// https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
async function getMedia(_constraints) {
	try {
		/* use the stream */
		if (stream == null) {
			stream = await navigator.mediaDevices.getUserMedia(_constraints);
			const localVideo = document.getElementById("local-video");
			// const localVideo = document.createElement("video");
			// localVideo.id = id;
			// document.body.appendChild(localVideo);
			if (localVideo) {
				localVideo.srcObject = stream;
			}
		}
		for (let id in clients) {
			// addStreamToPeerConnection(stream, clients[id]);
			if (!clients[id].streamAdded) {
				stream.getTracks().forEach(track => {
					clients[id].peerConnection.addTrack(track, stream)
				});
				clients[id].streamAdded = true;
			}
		}
	} catch (err) {
		console.warn(err);
		/* handle the error */
	}
}

getMedia(constraints);

// temporarily pause the outgoing stream
function disableOutgoingStream() {
	stream.getTracks().forEach(track => {
		track.enabled = false;
	})
}
// enable the outgoing stream
function enableOutgoingStream() {
	stream.getTracks().forEach(track => {
		track.enabled = true;
	})
}


// Adds client object with THREE.js object, DOM video object and and an RTC peer connection for each :
function addClient(_id) {


	console.log("Adding client with id " + _id);

	// create a video element for client:
	const remoteVideo = document.createElement("video");
	remoteVideo.width = videoWidth;
	remoteVideo.height = videoHeight;

	// remoteVideo.muted = true;
	// remoteVideo.style = "visibility: hidden;";

	remoteVideo.id = _id;
	remoteVideo.autoplay = true;
	document.body.appendChild(remoteVideo);

	// create a peer connection for  client:
	var peerConnectionConfiguration = { iceServers: iceServerList };
	let pc = new RTCPeerConnection(peerConnectionConfiguration);

	// add ontrack listener for peer connection
	pc.ontrack = function ({ streams: [_stream] }) {
		// TODO: split incoming stream into two streams -- audio for positional audio and 
		// video for video element --> canvas --> videoTexture --> videoMaterial for THREE.js
		// console.log()
		// let audioStream = new MediaStream([_stream.getAudioTracks()[0]]);
		// let audioEl = document.createElement("audio");
		// audioEl.autoplay = true;
		// document.body.appendChild(audioEl);
		// audioEl.srcObject = audioStream;
		// let audioStream = _stream.clone();

		// console.log('Making audioSource from stream: ')
		// console.log(audioStream.getAudioTracks());
		// let audioSource = makePositionalAudioSource(audioStream);

		// create a global audio source
		// var sound = new THREE.Audio(glScene.listener);
		// var audioSource = new THREE.PositionalAudio(glScene.listener);
		// audioSource.setMediaStreamSource(audioStream);
		// audioSource.setRefDistance(20);
		// audioSource.setVolume(0.9);
		// audioSource.play();

		// glScene.scene.add(audioSource);


		// glScene.scene.add(audioSource);
		// clients[_id].mesh.add(audioSource);

		// let videoStream = new MediaStream([_stream.getVideoTracks()[0]]);

		const remoteVideo = document.getElementById(_id);
		if (remoteVideo) {
			remoteVideo.srcObject = _stream;
			// remoteVideo.srcObject = videoStream;
		} else {
			console.warn("No video element found for ID: " + _id);
		}
	};

	// https://www.twilio.com/docs/stun-turn
	// Here's an example in javascript
	pc.onicecandidate = function (evt) {
		if (evt.candidate) {
			// console.log('Received ICE candidate:');
			// console.log(evt.candidate);

			socket.emit('addIceCandidate', {
				candidate: evt.candidate,
				to: _id
			});
			// send the candidate to the other party via your signaling channel
		}
	};

	let _body = new THREE.Mesh(
		new THREE.BoxGeometry(1, 1, 1),
		new THREE.MeshNormalMaterial()
	);
	_body.position.set(0, 0, 0);

	let [videoTexture, videoMaterial] = makeVideoTextureAndMaterial(_id);

	let _head = new THREE.Mesh(
		new THREE.BoxGeometry(1, 1, 1),
		videoMaterial
	);

	// set position of head before adding to parent object
	_head.position.set(0, 1, 0);
	_body.add(_head);

	// add audio source:
	// let _audioSource = makePositionalAudioSource(_id);
	// _body.add(_audioSource);

	// add mesh to scene
	glScene.scene.add(_body);

	// add new client to clients object
	clients[_id] = {
		mesh: _body,
		head: _head,
		texture: videoTexture,
		peerConnection: pc,
		streamAdded: false,
		isAlreadyCalling: false,
		videoCanvasCreated: true
	}
}










////////////////////////////////////////////////////////////////////////////////
// SOCKET SET UP ///////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
//On connection server sends the client his ID and a list of all keys
socket.on('introduction', (_id, _clientNum, _ids, _iceServers) => {
	// keep local copy of ice servers:
	iceServerList = _iceServers;
	console.log("Received ICE server credentials from server.");

	// keep a local copy of my ID:
	id = _id;
	console.log('My ID is: ' + id);

	for (let i = 0; i < _ids.length; i++) {
		if (_ids[i] != _id) {

			addClient(_ids[i]);

			setTimeout(() => callUser(_ids[i]), 5000);
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

		addClient(_id);

		// add new user to the scene
		glScene.scene.add(clients[_id].mesh);
	}

});

socket.on('userDisconnected', (clientCount, _id, _ids) => {
	// Update the data from the server
	// document.getElementById('numUsers').textContent = clientCount;

	if (_id != id) {
		console.log('A user disconnected with the id: ' + _id);
		let videoEl = document.getElementById(_id).remove();
		if (videoEl != null) { videoEl.remove(); }
		let canvasEl = document.getElementById(_id + "_canvas");
		if (canvasEl != null) { canvasEl.remove(); }
		glScene.scene.remove(clients[_id].mesh);
		delete clients[_id];
	}
});

socket.on('connect', () => { });

// Update when one of the users moves in space
socket.on('userPositions', _clientProps => {
	// console.log('Positions of all users are ', _clientProps, id);

	for (let _id in _clientProps) {
		if (_id != id) {
			//Store the values
			// let oldPos = clients[Object.keys(_clientProps)[i]].mesh.position;
			let newPos = _clientProps[_id].position;

			//Create a vector 3 and lerp the new values with the old values
			// let lerpedPos = new THREE.Vector3();
			// lerpedPos.x = THREE.Math.lerp(oldPos.x, newPos[0], 1);
			// lerpedPos.y = THREE.Math.lerp(oldPos.y, newPos[1], 1);
			// lerpedPos.z = THREE.Math.lerp(oldPos.z, newPos[2], 1);

			//Set the position
			// clients[Object.keys(_clientProps)[i]].mesh.position.set(lerpedPos.x, lerpedPos.y, lerpedPos.z);
			// let newPositionVec3 = new THREE.Vector3(newPos[0], newPos[1], newPos[2]);
			clients[_id].mesh.position.set(newPos[0], newPos[1], newPos[2]);

		}
	}
});




////////////////////////////////////////////////////////////////////////////////
// RTC Setup //
////////////////////////////////////////////////////////////////////////////////

async function callUser(id) {
	if (clients.hasOwnProperty(id)) {

		console.log('Calling user ' + id);

		// make sure we've set up the stream for this client's peerConnection
		getMedia(constraints);

		// https://blog.carbonfive.com/2014/10/16/webrtc-made-simple/
		// create offer with session description
		const offer = await clients[id].peerConnection.createOffer();
		await clients[id].peerConnection.setLocalDescription(new RTCSessionDescription(offer));

		socket.emit("call-user", {
			offer,
			to: id
		});
	}
}


socket.on("call-made", async data => {
	console.log("Receiving call from user " + data.socket);

	// make sure we've set up the stream for this client's peerConnection
	getMedia(constraints);

	// set remote session description to incoming offer
	await clients[data.socket].peerConnection.setRemoteDescription(
		new RTCSessionDescription(data.offer)
	);

	// makeVideoCanvas(data.socket);

	// create answer and set local session description to that answer
	const answer = await clients[data.socket].peerConnection.createAnswer();
	await clients[data.socket].peerConnection.setLocalDescription(new RTCSessionDescription(answer));

	// send answer out to caller
	socket.emit("make-answer", {
		answer,
		to: data.socket
	});

});

socket.on("answer-made", async data => {

	console.log("Answer made by " + data.socket);

	// set the remote description to be the incoming answer
	await clients[data.socket].peerConnection.setRemoteDescription(
		new RTCSessionDescription(data.answer)
	);

	// makeVideoCanvas(data.socket);

	// what is this for?
	if (!clients[data.socket].isAlreadyCalling) {
		callUser(data.socket);
		clients[data.socket].isAlreadyCalling = true;
	}

});

socket.on("call-rejected", data => {
	alert(`User: "Socket: ${data.socket}" rejected your call.`);
});

socket.on('iceCandidateFound', data => {
	clients[data.socket].peerConnection.addIceCandidate(data.candidate);
});






////////////////////////////////////////////////////////////////////////////////
// THREE.js video //////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

// Adapted from: https://github.com/zacharystenger/three-js-video-chat

function makeVideoTextureAndMaterial(_id) {
	// create a canvas and add it to the body
	let rvideoImageCanvas = document.createElement('canvas');
	document.body.appendChild(rvideoImageCanvas);

	rvideoImageCanvas.id = _id + "_canvas";
	rvideoImageCanvas.width = videoWidth;
	rvideoImageCanvas.height = videoHeight;

	// get canvas drawing context
	let rvideoImageContext = rvideoImageCanvas.getContext('2d');

	// background color if no video present
	rvideoImageContext.fillStyle = '#000000';
	rvideoImageContext.fillRect(0, 0, rvideoImageCanvas.width, rvideoImageCanvas.height);

	// make texture
	let videoTexture = new THREE.Texture(rvideoImageCanvas);
	videoTexture.minFilter = THREE.LinearFilter;
	videoTexture.magFilter = THREE.LinearFilter;

	// make material from texture
	var movieMaterial = new THREE.MeshBasicMaterial({ map: videoTexture, overdraw: true, side: THREE.DoubleSide });

	return [videoTexture, movieMaterial];
}



function makePositionalAudioSource(_audioStream) {
	// create the PositionalAudio object (passing in the listener)
	var audioSource = new THREE.PositionalAudio(glScene.listener);
	audioSource.setMediaStreamSource(_audioStream);
	audioSource.setRefDistance(20);
	audioSource.play();
	sound.setVolume(0.5);
	// console.log(audioSource);

	return audioSource;
}



function makeVideoCanvas(_id) {
	// let rvideo = document.getElementById(_id);
	if (!clients[_id].videoCanvasCreated) {

		// create a canvas and add it to the body
		let rvideoImageCanvas = document.createElement('canvas');
		document.body.appendChild(rvideoImageCanvas);

		rvideoImageCanvas.id = _id + "_canvas";
		rvideoImageCanvas.width = videoWidth;
		rvideoImageCanvas.height = videoHeight;

		// get canvas drawing context
		let rvideoImageContext = rvideoImageCanvas.getContext('2d');

		// background color if no video present
		rvideoImageContext.fillStyle = '#000000';
		rvideoImageContext.fillRect(0, 0, rvideoImageCanvas.width, rvideoImageCanvas.height);

		// make texture
		let rvideoTexture = new THREE.Texture(rvideoImageCanvas);
		rvideoTexture.minFilter = THREE.LinearFilter;
		rvideoTexture.magFilter = THREE.LinearFilter;

		// make material from texture
		var rmovieMaterial = new THREE.MeshBasicMaterial({ map: rvideoTexture, overdraw: true, side: THREE.DoubleSide });

		// https://stackoverflow.com/questions/23385623/three-js-proper-way-to-add-and-remove-child-objects-using-three-sceneutils-atta
		let headObject = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			rmovieMaterial
		);

		// set position of box before adding to parent object
		// headObject.position.set(clients[_id].mesh.position.x, clients[_id].mesh.position.y + 1, clients[_id].mesh.position.z);

		// clients[_id].head = headObject;
		clients[_id].mesh.add(headObject);
		headObject.position.set(clients[_id].mesh.position.x, clients[_id].mesh.position.y + 1, clients[_id].mesh.position.z);

		// store copy of texture for later updating
		clients[_id].tex = rvideoTexture;
		clients[_id].videoCanvasCreated = true;
	}


	// clients[_id].mesh.matererial = rmovieMaterial;
	// https://github.com/mrdoob/three.js/issues/2599
	// clients[_id].mesh.geometry.buffersNeedUpdate = true;
	// clients[_id].mesh.geometry.uvsNeedUpdate = true;
	// clients[_id].mesh.material.needsUpdate = true

}