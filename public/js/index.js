/* 
* YORB 2020
* 
* This uses code from a THREE.js Multiplayer boilerplate made by Or Fleisher:
* https://github.com/juniorxsound/THREE.Multiplayer
* And a WEBRTC chat app made by Mikołaj Wargowski:
* https://github.com/Miczeq22/simple-chat-app
*
*/

//A socket.io instance
const socket = io();

// Get access to local media stream (i.e. webcam and microphone stream)
let stream = null;
// https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
async function getMedia(constraints) {
	try {
		/* use the stream */
		stream = await navigator.mediaDevices.getUserMedia(constraints);
		const localVideo = document.getElementById("local-video");
		if (localVideo) {
			localVideo.srcObject = stream;
		}
		stream.getTracks().forEach(track => {
			for (let id in clients) {
				clients[id].peerConnection.addTrack(track, stream)
			}
		});

	} catch (err) {
		console.warn(err);
		/* handle the error */
	}
}

//One WebGL context to rule them all !
let glScene = new Scene();
let id;
let instances = [];
let clients = new Object();

const videoWidth = 160;
const videoHeight = 120;

// glScene.on('userMoved', () => {
//   socket.emit('move', [glScene.camera.position.x, glScene.camera.position.y, glScene.camera.position.z]);
// });

//On connection server sends the client his ID and a list of all keys
socket.on('introduction', (_id, _clientNum, _ids) => {

	for (let i = 0; i < _ids.length; i++) {
		if (_ids[i] != _id) {

			// create a peer connection for each client:
			let pc = new RTCPeerConnection();

			clients[_ids[i]] = {
				mesh: new THREE.Mesh(
					new THREE.BoxGeometry(1, 1, 1),
					new THREE.MeshNormalMaterial()
				),
				peerConnection: pc
			}

			// create a video element for each client:
			const remoteVideo = document.createElement("video");
			remoteVideo.id = _id;
			remoteVideo.autoplay = true;
			document.body.appendChild(remoteVideo);

			// set peer connection 'ontrack' listener to stream video to DOM element
			clients[_ids[i]].peerConnection.ontrack = function ({ streams: [stream] }) {
				console.log("On track!");
				// const remoteVideo = document.getElementById("remote-video");
				const remoteVideo = document.getElementById(_id);
				if (remoteVideo) {
					remoteVideo.srcObject = stream;
				} else {
					console.warn("No video element found for ID: " + _id);
				}
			};


			//Add initial users to the scene
			glScene.scene.add(clients[_ids[i]].mesh);
		}
	}

	console.log("Introduction of clients: ");
	console.log(clients);

	// set constraints on local audio/video stream
	// is there a better place to do this?
	// what should constraints be to allow for many streams...?
	let constraints = {
		audio: true,
		video: {
			width: videoWidth,
			height: videoHeight,
			frameRate: 15
		}
	}
	getMedia(constraints);


	// keep a local copy of my ID:
	id = _id;
	console.log('My ID is: ' + id);

});

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

		// add a peerConnection for each user
		let pc = new RTCPeerConnection();

		clients[_id] = {
			mesh: new THREE.Mesh(
				new THREE.BoxGeometry(10, 10, 10),
				new THREE.MeshNormalMaterial()
			),
			peerConnection: pc
		}

		// create a video element for each client:
		const remoteVideo = document.createElement("video");
		remoteVideo.id = _id;
		remoteVideo.autoplay = true;
		document.body.appendChild(remoteVideo);

		// set peer connection 'ontrack' listener to stream video to DOM element
		clients[_id].peerConnection.ontrack = function ({ streams: [stream] }) {
			// const remoteVideo = document.getElementById("remote-video");
			const remoteVideo = document.getElementById(_id);
			if (remoteVideo) {
				remoteVideo.srcObject = stream;
			} else {
				console.warn("No video element found for ID: " + _id);
			}
		};

		// set the new peerConnection to use our local stream
		stream.getTracks().forEach(track => {
			clients[_id].peerConnection.addTrack(track, stream)
		});

		callUser(_id);

		//Add initial users to the scene
		glScene.scene.add(clients[_id].mesh);
	}

});

socket.on('userDisconnected', (clientCount, _id, _ids) => {
	//Update the data from the server
	// document.getElementById('numUsers').textContent = clientCount;

	if (_id != id) {
		console.log('A user disconnected with the id: ' + _id);
		glScene.scene.remove(clients[_id].mesh);
		delete clients[_id];
	}
});

socket.on('connect', () => { });

//Update when one of the users moves in space
socket.on('userPositions', _clientProps => {
	// console.log('Positions of all users are ', _clientProps, id);
	// console.log(Object.keys(_clientProps)[0] == id);
	for (let i = 0; i < Object.keys(_clientProps).length; i++) {
		if (Object.keys(_clientProps)[i] != id) {

			//Store the values
			let oldPos = clients[Object.keys(_clientProps)[i]].mesh.position;
			let newPos = _clientProps[Object.keys(_clientProps)[i]].position;

			//Create a vector 3 and lerp the new values with the old values
			let lerpedPos = new THREE.Vector3();
			lerpedPos.x = THREE.Math.lerp(oldPos.x, newPos[0], 0.3);
			lerpedPos.y = THREE.Math.lerp(oldPos.y, newPos[1], 0.3);
			lerpedPos.z = THREE.Math.lerp(oldPos.z, newPos[2], 0.3);

			//Set the position
			clients[Object.keys(_clientProps)[i]].mesh.position.set(lerpedPos.x, lerpedPos.y, lerpedPos.z);
		}
	}
});

function createNewClient(id) {

}

// https://github.com/Miczeq22/simple-chat-app
let isAlreadyCalling = false;
let getCalled = false;
const existingCalls = [];
const { RTCPeerConnection, RTCSessionDescription } = window;
const peerConnection = new RTCPeerConnection();


// function unselectUsersFromList() {
//   const alreadySelectedUser = document.querySelectorAll(
//     ".active-user.active-user--selected"
//   );

//   alreadySelectedUser.forEach(el => {
//     el.setAttribute("class", "active-user");
//   });
// }

// function createUserItemContainer(socketId) {
//   const userContainerEl = document.createElement("div");

//   const usernameEl = document.createElement("p");

//   userContainerEl.setAttribute("class", "active-user");
//   userContainerEl.setAttribute("id", socketId);
//   usernameEl.setAttribute("class", "username");
//   usernameEl.innerHTML = `Socket: ${socketId}`;

//   userContainerEl.appendChild(usernameEl);

//   userContainerEl.addEventListener("click", () => {
//     unselectUsersFromList();
//     userContainerEl.setAttribute("class", "active-user active-user--selected");
//     const talkingWithInfo = document.getElementById("talking-with-info");
//     talkingWithInfo.innerHTML = `Talking with: "Socket: ${socketId}"`;
//     callUser(socketId);
//   });

//   return userContainerEl;
// }

async function callUser(id) {

	// if (stream != null) {
	// 	stream.getTracks().forEach(track => {
	// 		clients[id].peerConnection.addTrack(track, stream)
	// 	});
	// } else {
	// 	console.warn('no stream present!');
	// }
	// getMedia({ video: true, audio: true });


	console.log('Calling user ' + id);

	const offer = await clients[id].peerConnection.createOffer();
	await clients[id].peerConnection.setLocalDescription(new RTCSessionDescription(offer));
	// const offer = await peerConnection.createOffer();
	// await peerConnection.setLocalDescription(new RTCSessionDescription(offer));

	socket.emit("call-user", {
		offer,
		to: id
	});
}

// function updateUserList(socketIds) {
//   const activeUserContainer = document.getElementById("active-user-container");

//   socketIds.forEach(socketId => {
//     const alreadyExistingUser = document.getElementById(socketId);
//     if (!alreadyExistingUser) {
//       const userContainerEl = createUserItemContainer(socketId);

//       activeUserContainer.appendChild(userContainerEl);
//     }
//   });
// }

// // const socket = io.connect("localhost:5000");

// socket.on("update-user-list", ({ users }) => {
//   updateUserList(users);
// });

// socket.on("remove-user", ({ socketId }) => {
//   const elToRemove = document.getElementById(socketId);

//   if (elToRemove) {
//     elToRemove.remove();
//   }
// });

socket.on("call-made", async data => {
	console.log("____________CALL MADE___________");
	if (getCalled) {
		// const confirmed = confirm(
		// 	`User "Socket: ${data.socket}" wants to call you. Do accept this call?`
		// );
		const confirmed = true;

		if (!confirmed) {
			socket.emit("reject-call", {
				from: data.socket
			});

			return;
		}
	}
	console.log(clients[data.socket]);
	console.log("Call-made by " + data.socket);

	await clients[data.socket].peerConnection.setRemoteDescription(
		new RTCSessionDescription(data.offer)
	);
	const answer = await clients[data.socket].peerConnection.createAnswer();
	await clients[data.socket].peerConnection.setLocalDescription(new RTCSessionDescription(answer));

	socket.emit("make-answer", {
		answer,
		to: data.socket
	});
	getCalled = true;
});

socket.on("answer-made", async data => {
	console.log("____________ANSWER MADE___________");

	console.log("Answer made by " + data.socket);
	console.log("Attempting to connect using PC: " + clients[data.socket].peerConnection);

	makeClientVideoSkin(data.socket);
	
	await clients[data.socket].peerConnection.setRemoteDescription(
		new RTCSessionDescription(data.answer)
	);

	if (!isAlreadyCalling) {
		callUser(data.socket);
		isAlreadyCalling = true;
	}
});

socket.on("call-rejected", data => {
	alert(`User: "Socket: ${data.socket}" rejected your call.`);
	// unselectUsersFromList();
});




// navigator.getUserMedia(
// 	{ video: true, audio: true },
// 	stream => {
// 		const localVideo = document.getElementById("local-video");
// 		if (localVideo) {
// 			localVideo.srcObject = stream;
// 		}

// 		stream.getTracks().forEach(track => {
// 			for (let id in clients) {
// 				clients[id].peerConnection.addTrack(track, stream)
// 			}

// 		});
// 	},
// 	error => {
// 		console.warn(error.message);
// 	}
// );



var video, videoImage, videoImageContext, videoTexture, movieScreen;
var rvideo, rvideoImage, rvideoImageContext, rvideoTexture, rmovieScreen;

// from https://github.com/zacharystenger/three-js-video-chat
function addRemoteVideo() {
	rvideo = document.getElementById('remote-video');

	rvideoImage = document.getElementById('remoteVideoImage');
	rvideoImageContext = rvideoImage.getContext('2d');

	// background color if no video present
	rvideoImageContext.fillStyle = '#000000';
	rvideoImageContext.fillRect(0, 0, rvideoImage.width, rvideoImage.height);

	rvideoTexture = new THREE.Texture(rvideoImage);
	rvideoTexture.minFilter = THREE.LinearFilter;
	rvideoTexture.magFilter = THREE.LinearFilter;

	var rmovieMaterial = new THREE.MeshBasicMaterial({ map: rvideoTexture, overdraw: true, side: THREE.DoubleSide });
	// the geometry on which the movie will be displayed;
	// 		movie image will be scaled to fit these dimensions.
	var rmovieGeometry = new THREE.PlaneGeometry(100, 100, 1, 1);
	rmovieScreen = new THREE.Mesh(rmovieGeometry, rmovieMaterial);

	rmovieScreen.position.set(-100, 50, 0);
	rmovieScreen.rotation.y = Math.PI / 4;
	glScene.scene.add(rmovieScreen);
}

function makeClientVideoSkin(_id) {
	rvideo = document.getElementById(_id);

	rvideoImage = document.createElement('canvas');
	document.body.appendChild(rvideoImage);
	rvideoImage.id = _id + "_canvas";
	rvideoImage.width = videoWidth;
	rvideoImage.height = videoHeight;
	rvideoImageContext = rvideoImage.getContext('2d');

	// background color if no video present
	rvideoImageContext.fillStyle = '#000000';
	rvideoImageContext.fillRect(0, 0, rvideoImage.width, rvideoImage.height);

	rvideoTexture = new THREE.Texture(rvideoImage);
	rvideoTexture.minFilter = THREE.LinearFilter;
	rvideoTexture.magFilter = THREE.LinearFilter;

	var rmovieMaterial = new THREE.MeshBasicMaterial({ map: rvideoTexture, overdraw: true, side: THREE.DoubleSide });

	// https://stackoverflow.com/questions/23385623/three-js-proper-way-to-add-and-remove-child-objects-using-three-sceneutils-atta
	let newBox = new THREE.Mesh(
		new THREE.BoxGeometry(10, 10, 10),
		rmovieMaterial
	);

	newBox.position.set(clients[_id].mesh.position.x,clients[_id].mesh.position.y + 10,clients[_id].mesh.position.z);

	clients[_id].mesh.add(newBox);




	// clients[_id].mesh.matererial = rmovieMaterial;
	// https://github.com/mrdoob/three.js/issues/2599
	// clients[_id].mesh.geometry.buffersNeedUpdate = true;
	// clients[_id].mesh.geometry.uvsNeedUpdate = true;
	// clients[_id].mesh.material.needsUpdate = true


	// the geometry on which the movie will be displayed;
	// 		movie image will be scaled to fit these dimensions.
	// var rmovieGeometry = new THREE.PlaneGeometry(100, 100, 1, 1);
	// rmovieScreen = new THREE.Mesh(rmovieGeometry, rmovieMaterial);

	// rmovieScreen.position.set(-100, 50, 0);
	// rmovieScreen.rotation.y = Math.PI / 4;
	// glScene.scene.add(rmovieScreen);
}