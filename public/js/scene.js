/* 
* YORB 2020
* 
* Adapted from a THREE.js Multiplayer boilerplate made by Or Fleisher:
* https://github.com/juniorxsound/THREE.Multiplayer
* with terrain from https://github.com/mrdoob/three.js/blob/master/examples/webgl_geometry_terrain.html
*
*/

let myMouse;

class Scene {
	constructor(
		domElement = document.getElementById('gl_context'),
		_width = window.innerWidth,
		_height = window.innerHeight,
		hasControls = true,
		clearColor = 'lightblue',
		_movementCallback) {

		document.addEventListener('mousemove', this.onDocumentMouseMove, false);

		this.movementCallback = _movementCallback;

		//THREE scene
		this.scene = new THREE.Scene();

		//Utility
		this.width = _width;
		this.height = _height;

		// Player mesh (for 3rd Person view):
		// this.player = new THREE.Mesh(
		// 	new THREE.BoxGeometry(1, 1, 1),
		// 	new THREE.MeshNormalMaterial()
		// );
		// this.player.position.set(0, 0, 0);
		// // let [videoTexture, videoMaterial] = makeVideoTextureAndMaterial("local-video");
		// this.playerHead = new THREE.Mesh(
		// 	new THREE.BoxGeometry(1, 1, 1),
		// 	new THREE.MeshNormalMaterial()
		// );
		// this.playerHead.position.set(0, 1, 0);
		// this.player.add(this.playerHead);
		// this.scene.add(this.player);
		let _body = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			new THREE.MeshNormalMaterial()
		);

		createLocalVideoElement();

		let [videoTexture, videoMaterial] = makeVideoTextureAndMaterial("local");

		let _head = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			videoMaterial
		);


		// set position of head before adding to parent object
		_body.position.set(0, 0, 0);
		_head.position.set(0, 1, 0);

		// https://threejs.org/docs/index.html#api/en/objects/Group
		this.playerGroup = new THREE.Group();
		this.playerGroup.add(_body);
		this.playerGroup.add(_head);
		this.playerVideoTexture = videoTexture;

		// add group to scene
		this.scene.add(this.playerGroup);

		// 
		myMouse = new THREE.Vector2();
		this.INTERSECTED = null;
		// var radius = 100, theta = 0;
		this.raycaster = new THREE.Raycaster();

		//THREE Camera
		this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 5000);
		this.camera.position.set(0, 3, 5);
		this.camera.lookAt(this.playerGroup.position);
		this.scene.add(this.camera);

		// create an AudioListener and add it to the camera
		this.listener = new THREE.AudioListener();
		this.camera.add(this.listener);

		// create group to house player and camera
		// this.playerCamGroup = new THREE.Group();
		// this.playerCamGroup.add(this.player);
		// this.playerCamGroup.add(this.camera);

		// add this group to the scene
		// this.scene.add(this.playerCamGroup);

		//THREE WebGL renderer
		this.renderer = new THREE.WebGLRenderer({
			antialiasing: true
		});

		this.renderer.setClearColor(new THREE.Color(clearColor));

		// add controls:
		// https://github.com/PiusNyakoojo/PlayerControls
		this.controls = new THREE.PlayerControls(this.camera, this.playerGroup);

		this.renderer.setSize(this.width, this.height);

		this.scene.add(new THREE.AmbientLight(0xFFFFFF));

		// var loader = new THREE.GLTFLoader();
		// this.floorModel;
		// loader.load('models/itp-2.glb', (gltf) => {

		// 	this.floorModel = gltf.scene;
		// 	this.floorModel.position.set(0, 0, 0);
		// 	this.floorModel.scale.set(2, 2, 2);
		// 	this.floorModel.traverse(function (child) {
		// 		if (child.isMesh) {

		// 			// child.material = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff });

		// 			// child.material.envMap = envMap;
		// 		}

		// 	});

		// 	this.scene.add(this.floorModel);
		// }, undefined, function (e) {
		// 	console.error(e);
		// });


		//Push the canvas to the DOM
		domElement.append(this.renderer.domElement);

		// if (hasControls) {
		// 	this.controls = new THREE.FirstPersonControls(this.camera, this.renderer.domElement);
		// 	this.controls.lookSpeed =0.1;
		// }

		//Setup event listeners for events and handle the states
		window.addEventListener('resize', e => this.onWindowResize(e), false);
		domElement.addEventListener('mouseenter', e => this.onEnterCanvas(e), false);
		domElement.addEventListener('mouseleave', e => this.onLeaveCanvas(e), false);
		window.addEventListener('keydown', e => this.onKeyDown(e), false);

		this.helperGrid = new THREE.GridHelper(100, 100);
		this.helperGrid.position.y = -0.5;
		this.scene.add(this.helperGrid);
		this.clock = new THREE.Clock();

		this.update();
	}

	addClient(_id) {

		let _body = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			new THREE.MeshNormalMaterial()
		);


		createClientVideoElement(_id);

		let [videoTexture, videoMaterial] = makeVideoTextureAndMaterial(_id);

		let _head = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			videoMaterial
		);


		// set position of head before adding to parent object
		_body.position.set(0, 0, 0);
		_head.position.set(0, 1, 0);

		// https://threejs.org/docs/index.html#api/en/objects/Group
		var group = new THREE.Group();
		group.add(_body);
		group.add(_head);

		// add audio source:
		// let _audioSource = makePositionalAudioSource(_id);
		// _body.add(_audioSource);

		// add group to scene
		this.scene.add(group);

		clients[_id].group = group;
		clients[_id].texture = videoTexture;
	}

	removeClient(_id) {
		this.scene.remove(clients[_id].group);

		removeClientVideoElementAndCanvas(_id);
	}

	updateClientPositions(_clientProps) {
		for (let _id in _clientProps) {
			// we'll update ourselves separately to avoid lag...
			if (_id != id) {
				//Store the values
				// let oldPos = clients[Object.keys(_clientProps)[i]].group.position;
				let newPos = _clientProps[_id].position;

				//Create a vector 3 and lerp the new values with the old values
				// let lerpedPos = new THREE.Vector3();
				// lerpedPos.x = THREE.Math.lerp(oldPos.x, newPos[0], 1);
				// lerpedPos.y = THREE.Math.lerp(oldPos.y, newPos[1], 1);
				// lerpedPos.z = THREE.Math.lerp(oldPos.z, newPos[2], 1);

				//Set the position
				// clients[Object.keys(_clientProps)[i]].group.position.set(lerpedPos.x, lerpedPos.y, lerpedPos.z);
				// let newPositionVec3 = new THREE.Vector3(newPos[0], newPos[1], newPos[2]);
				clients[_id].group.position.set(newPos[0], newPos[1], newPos[2]);
			}
		}
	}

	crazyColors() {
		// envmap
		var path = 'models/Park2/';
		var format = '.jpg';
		var envMap = new THREE.CubeTextureLoader().load([
			path + 'posx' + format, path + 'negx' + format,
			path + 'posy' + format, path + 'negy' + format,
			path + 'posz' + format, path + 'negz' + format
		]);

		this.floorModel.traverse(function (child) {
			if (child.isMesh) {

				// child.material = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff });

				child.material = new THREE.MeshPhongMaterial({
					color: Math.random() * 0xffffff,
					specular: 0.75,
					reflectivity: 0.75,
					shininess: 0.75,
					envMap: envMap
				});
				// child.material.envMap = envMap;
			}

		});
	}


	// drawUsers(positions, id) {
	// 	for (let i = 0; i < Object.keys(positions).length; i++) {
	// 		if (Object.keys(positions)[i] != id) {
	// 			this.users[i].position.set(positions[Object.keys(positions)[i]].position[0],
	// 				positions[Object.keys(positions)[i]].position[1],
	// 				positions[Object.keys(positions)[i]].position[2]);
	// 		}
	// 	}
	// }


	update() {
		requestAnimationFrame(() => this.update());

		// this.raycaster.setFromCamera(myMouse, this.camera);

		// var intersects = this.raycaster.intersectObjects(this.scene.children);

		// if (intersects.length > 0) {

		// 	if (this.INTERSECTED != intersects[0].object) {
		// 		if (this.INTERSECTED) {
		// 			console.log(this.INTERSECTED);
		// 			// this.INTERSECTED.material.emissive.setHex( this.INTERSECTED.currentHex );
		// 		}

		// 		this.INTERSECTED = intersects[0].object;
		// 		// this.INTERSECTED.currentHex = this.INTERSECTED.material.emissive.getHex();
		// 		// this.INTERSECTED.material.emissive.setHex(0xff0000);

		// 	}

		// } else {

		// 	if (this.INTERSECTED) {
		// 		// this.INTERSECTED.material.emissive.setHex(this.INTERSECTED.currentHex);
		// 	}

		// 	this.INTERSECTED = null;

		// }


		// this.controls.update(this.clock.getDelta());
		// this.controls.target = new THREE.Vector3(0, 0, 0);
		this.controls.update();
		this.render();
	}

	onDocumentMouseMove(event) {

		event.preventDefault();

		myMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		myMouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

	}

	updateVideoTextures() {
		// update ourselves first:

		let localVideo = document.getElementById("local_video");
		let localVideoCanvas = document.getElementById("local_canvas");
		// https://stackoverflow.com/questions/8168217/html-canvas-how-to-draw-a-flipped-mirrored-image
		// let ctx = localVideoCanvas.getContext('2d')
		// ctx.translate(localVideoCanvas.width, 0);
		// ctx.scale(-1, 1); // flip local image
		this.redrawVideoCanvas(localVideo, localVideoCanvas, this.playerVideoTexture)

		// localVideoCanvas.getContext('2d').scale(-1, 1); // flip local image

		for (let _id in clients) {

			// video DOM element
			let remoteVideo = document.getElementById(_id);
			// video canvas DOM element
			let remoteVideoCanvas = document.getElementById(_id + "_canvas");
			this.redrawVideoCanvas(remoteVideo, remoteVideoCanvas, clients[_id].texture);


			// if (remoteVideo) {
			// 	if (remoteVideo.readyState === remoteVideo.HAVE_ENOUGH_DATA) {
			// 		remoteVideoImageContext.drawImage(remoteVideo, 0, 0, remoteVideoCanvas.width, remoteVideoCanvas.height);
			// 		if (clients[_id].texture) {
			// 			clients[_id].texture.needsUpdate = true;
			// 		}
			// 		if (this.playerVideoTexture) {
			// 			this.playerVideoTexture.needsUpdate = true;
			// 		}

			// 	}
			// }
		}
	}

	// this function redraws on a 2D <canvas> from a <video> and indicates to three.js
	// that the _videoTex should be updated
	redrawVideoCanvas(_videoEl, _canvasEl, _videoTex) {
		let _canvasDrawingContext = _canvasEl.getContext('2d');

		// if (_videoEl) {
		// check that we have enough data on the video element to redraw the canvas
		if (_videoEl.readyState === _videoEl.HAVE_ENOUGH_DATA) {
			// if so, redraw the canvas from the video element
			_canvasDrawingContext.drawImage(_videoEl, 0, 0, _canvasEl.width, _canvasEl.height);
			// and indicate to three.js that the texture needs to be redrawn from the canvas
			_videoTex.needsUpdate = true;
		}
		// }
	}

	render() {
		// Update video canvases for each client
		this.updateVideoTextures();

		this.renderer.render(this.scene, this.camera);
	}

	onWindowResize(e) {
		this.width = window.innerWidth;
		this.height = Math.floor(window.innerHeight - (window.innerHeight * 0.3));
		this.camera.aspect = this.width / this.height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(this.width, this.height);
	}

	onLeaveCanvas(e) {
		// this.controls.enabled = false;
	}
	onEnterCanvas(e) {
		// this.controls.enabled = true;
	}
	onKeyDown(e) {
		this.movementCallback();
	}

	getPlayerPosition() {
		// notice the y height hack...
		return [this.playerGroup.position.x, 0.0, this.playerGroup.position.z];
	}
}

// from here: https://github.com/mrdoob/three.js/blob/master/examples/webgl_geometry_terrain.html
function generateTexture(data, width, height) {

	var canvas, canvasScaled, context, image, imageData, vector3, sun, shade;

	vector3 = new THREE.Vector3(0, 0, 0);

	sun = new THREE.Vector3(1, 1, 1);
	sun.normalize();

	canvas = document.createElement('canvas');

	canvas.width = width;
	canvas.height = height;

	context = canvas.getContext('2d');
	context.fillStyle = '#000';
	context.fillRect(0, 0, width, height);

	image = context.getImageData(0, 0, canvas.width, canvas.height);
	imageData = image.data;

	for (var i = 0, j = 0, l = imageData.length; i < l; i += 4, j++) {

		vector3.x = data[j - 2] - data[j + 2];
		vector3.y = 2;
		vector3.z = data[j - width * 2] - data[j + width * 2];
		vector3.normalize();

		shade = vector3.dot(sun);

		imageData[i] = (96 + shade * 128) * (0.5 + data[j] * 0.007);
		imageData[i + 1] = (32 + shade * 96) * (0.5 + data[j] * 0.007);
		imageData[i + 2] = (shade * 96) * (0.5 + data[j] * 0.007);

	}

	context.putImageData(image, 0, 0);

	// Scaled 4x

	canvasScaled = document.createElement('canvas');
	canvasScaled.width = width * 4;
	canvasScaled.height = height * 4;

	context = canvasScaled.getContext('2d');
	context.scale(4, 4);
	context.drawImage(canvas, 0, 0);

	image = context.getImageData(0, 0, canvasScaled.width, canvasScaled.height);
	imageData = image.data;

	for (var i = 0, l = imageData.length; i < l; i += 4) {

		var v = ~ ~(Math.random() * 5);

		imageData[i] += v;
		imageData[i + 1] += v;
		imageData[i + 2] += v;

	}

	context.putImageData(image, 0, 0);

	return canvasScaled;

}


// created <video> element for local element
function createLocalVideoElement() {
	const videoElement = document.createElement("video");
	videoElement.id = "local_video";
	videoElement.autoplay = true;
	videoElement.width = videoWidth;
	videoElement.height = videoHeight;

	// there seems to be a weird behavior where a muted video 
	// won't autoplay.  so instead of muting the video, simply make a
	// video only stream for this video element:
	let videoStream = new MediaStream([localMediaStream.getVideoTracks()[0]]);

	videoElement.srcObject = videoStream;
	document.body.appendChild(videoElement);
}

// created <video> element using client ID
function createClientVideoElement(_id) {
	console.log("Creating <video> element for client with id: " + _id);

	const videoElement = document.createElement("video");
	videoElement.id = _id;

	videoElement.width = videoWidth;
	videoElement.height = videoHeight;
	videoElement.autoplay = true;
	// videoElement.muted = true;
	// videoElement.style = "visibility: hidden;";

	document.body.appendChild(videoElement);
}

// remove <video> element and corresponding <canvas> using client ID
function removeClientVideoElementAndCanvas(_id) {
	console.log("Removing <video> element for client with id: " + _id);

	let videoEl = document.getElementById(_id).remove();
	if (videoEl != null) { videoEl.remove(); }
	let canvasEl = document.getElementById(_id + "_canvas");
	if (canvasEl != null) { canvasEl.remove(); }
}

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