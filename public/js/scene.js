/* 
* YORB 2020
* 
* Adapted from a THREE.js Multiplayer boilerplate made by Or Fleisher:
* https://github.com/juniorxsound/THREE.Multiplayer
* with terrain from https://github.com/mrdoob/three.js/blob/master/examples/webgl_geometry_terrain.html
*
* Aidan Nelson, April 2020
*
*/

class Scene {
	constructor(
		domElement = document.getElementById('gl_context'),
		_width = window.innerWidth,
		_height = window.innerHeight,
		clearColor = 'lightblue',
		_movementCallback) {

		this.movementCallback = _movementCallback;

		//THREE scene
		this.scene = new THREE.Scene();
		this.framecount = 0;
		this.keyState = {};

		//Utility
		this.width = _width;
		this.height = _height;

		// crazy colors:
		this.crazyMode = false;
		this.originalFloorMaterials = [];


		//Add Player
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
		this.playerGroup.position.set(0, 0.5, 0);
		this.playerGroup.add(_body);
		this.playerGroup.add(_head);
		this.playerVideoTexture = videoTexture;

		// add group to scene
		this.scene.add(this.playerGroup);

		// Raycaster
		this.raycaster = new THREE.Raycaster();

		//THREE Camera
		this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 5000);
		this.camera.position.set(0, 3, 3);
		this.scene.add(this.camera);

		// create an AudioListener and add it to the camera
		this.listener = new THREE.AudioListener();
		// this.camera.add(this.listener);
		this.playerGroup.add(this.listener);

		//THREE WebGL renderer
		this.renderer = new THREE.WebGLRenderer({
			antialiasing: true
		});

		this.renderer.setClearColor(new THREE.Color(clearColor));

		// add controls:
		// https://github.com/PiusNyakoojo/PlayerControls
		this.controls = new THREE.PlayerControls(this.camera, this.playerGroup);

		this.renderer.setSize(this.width, this.height);

		// add some lights
		this.scene.add(new THREE.AmbientLight(0x404040, 4));

		// White directional light at half intensity shining from the top.
		//https://threejs.org/docs/#api/en/lights/DirectionalLight
		var directionalLight = new THREE.DirectionalLight(0xffffff, 2);
		this.scene.add(directionalLight);
		var targetObject = new THREE.Object3D();
		targetObject.position.set(10, 0, 10);
		this.scene.add(targetObject);

		directionalLight.target = targetObject;

		// environment map from three.js examples
		var path = 'models/Park2/';
		var format = '.jpg';
		this.envMap = new THREE.CubeTextureLoader().load([
			path + 'posx' + format, path + 'negx' + format,
			path + 'posy' + format, path + 'negy' + format,
			path + 'posz' + format, path + 'negz' + format
		]);
		this.scene.background = this.envMap;

		// load floor model
		var loader = new THREE.GLTFLoader();
		this.floorModel = null;
		loader.load('models/2020-04-07--ITP-for-threejs.glb', (gltf) => {

			this.floorModel = gltf.scene;
			this.floorModel.position.set(0, 0, 0);
			this.floorModel.scale.set(2, 2, 2); // seems about right
			this.scene.add(this.floorModel);
		}, undefined, function (e) {
			console.error(e);
		});

		//Push the canvas to the DOM
		domElement.append(this.renderer.domElement);

		//Setup event listeners for events and handle the states
		window.addEventListener('resize', e => this.onWindowResize(e), false);
		domElement.addEventListener('mouseenter', e => this.onEnterCanvas(e), false);
		domElement.addEventListener('mouseleave', e => this.onLeaveCanvas(e), false);
		window.addEventListener('keydown', e => this.onKeyDown(e), false);
		window.addEventListener('keyup', e => this.onKeyUp(e), false);

		this.helperGrid = new THREE.GridHelper(500, 500);
		this.helperGrid.position.y = -0.1;
		this.scene.add(this.helperGrid);

		this.update();
	}

	// add a client meshes, a video element and  canvas for three.js video texture
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

		// add group to scene
		this.scene.add(group);

		clients[_id].group = group;
		clients[_id].texture = videoTexture;
		clients[_id].desiredPosition = new THREE.Vector3();
		clients[_id].desiredRotation = new THREE.Quaternion();
		clients[_id].oldPos = group.position
		clients[_id].oldRot = group.quaternion;
		clients[_id].movementAlpha = 0;
	}

	removeClient(_id) {
		this.scene.remove(clients[_id].group);

		removeClientVideoElementAndCanvas(_id);
	}

	// overloaded function can deal with new info or not
	updateClientPositions(_clientProps) {

		for (let _id in _clientProps) {
			// we'll update ourselves separately to avoid lag...
			if (_id != id) {
				clients[_id].desiredPosition = new THREE.Vector3().fromArray(_clientProps[_id].position);
				clients[_id].desiredRotation = new THREE.Quaternion().fromArray(_clientProps[_id].rotation)
			}
		}
	}

	updatePositions() {
		let snapDistance = 0.5;
		let snapAngle = 0.2; // radians
		for (let _id in clients) {

			clients[_id].group.position.lerp(clients[_id].desiredPosition, 0.2);
			clients[_id].group.quaternion.slerp(clients[_id].desiredRotation, 0.2);
			if (clients[_id].group.position.distanceTo(clients[_id].desiredPosition) < snapDistance) {
				clients[_id].group.position.set(clients[_id].desiredPosition.x, clients[_id].desiredPosition.y, clients[_id].desiredPosition.z);
			}
			if (clients[_id].group.quaternion.angleTo(clients[_id].desiredRotation) < snapAngle) {
				clients[_id].group.quaternion.set(clients[_id].desiredRotation.x, clients[_id].desiredRotation.y, clients[_id].desiredRotation.z, clients[_id].desiredRotation.w);
			}
		}
	}

	// color mode
	crazyColors() {
		this.floorModel.traverse((child) => {
			if (child.isMesh) {
				if (this.crazyMode) {
					// if we're already in crazy mode, restore materials
					child.material = this.originalFloorMaterials.pop();
				} else {
					this.originalFloorMaterials.push(child.material);
					child.material = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff });
				}
			}
		});
		this.crazyMode = !this.crazyMode;
	}



	// TODO...
	//https://github.com/stemkoski/stemkoski.github.com/blob/master/Three.js/Collision-Detection.html
	detectCollisions() {
		// from player controls direction
		let xDir = -  Math.sin(this.controls.player.rotation.y);
		let zDir = - Math.cos(this.controls.player.rotation.y);
		let dirVec = new THREE.Vector3(xDir, 0, zDir);
		dirVec.normalize();

		this.raycaster.set(this.playerGroup.position, dirVec);

		if (this.floorModel != null) {
			// console.log(this.floorModel.children);
			let meshArr = [];
			// only grab the important stuff, no need to check intersection with lights
			meshArr = meshArr.concat(this.floorModel.children[2].children);
			meshArr = meshArr.concat(this.floorModel.children[7].children);
			meshArr = meshArr.concat(this.floorModel.children[10].children);

			var intersects = this.raycaster.intersectObjects(meshArr);

			if (intersects.length > 0) {
				for (let i = 0; i < intersects.length; i++) {
					if (intersects[i].distance < 2) {
						console.log("Approaching obstacle!");
					}
				}
			}
		}
	}


	// LOOP
	update() {
		requestAnimationFrame(() => this.update());

		// send movement stats to the server if any of the keys are pressed
		let sendStats = false;
		for (let i in this.keyState) {
			if (this.keyState[i]) {
				sendStats = true;
				break;
			}
		}
		if (sendStats) { this.movementCallback(); }


		this.updatePositions();
		this.detectCollisions();
		this.controls.update();

		this.render();
	}

	updateVideoTextures() {
		// update ourselves first:
		let localVideo = document.getElementById("local_video");
		let localVideoCanvas = document.getElementById("local_canvas");

		// TODO: mirror local video --> canvas
		// https://stackoverflow.com/questions/8168217/html-canvas-how-to-draw-a-flipped-mirrored-image
		// let ctx = localVideoCanvas.getContext('2d')
		// ctx.translate(localVideoCanvas.width, 0);
		// ctx.scale(-1, 1); // flip local image
		this.redrawVideoCanvas(localVideo, localVideoCanvas, this.playerVideoTexture)


		for (let _id in clients) {
			let remoteVideo = document.getElementById(_id);
			let remoteVideoCanvas = document.getElementById(_id + "_canvas");
			this.redrawVideoCanvas(remoteVideo, remoteVideoCanvas, clients[_id].texture);
		}
	}

	// this function redraws on a 2D <canvas> from a <video> and indicates to three.js
	// that the _videoTex should be updated
	redrawVideoCanvas(_videoEl, _canvasEl, _videoTex) {
		let _canvasDrawingContext = _canvasEl.getContext('2d');

		// check that we have enough data on the video element to redraw the canvas
		if (_videoEl.readyState === _videoEl.HAVE_ENOUGH_DATA) {
			// if so, redraw the canvas from the video element
			_canvasDrawingContext.drawImage(_videoEl, 0, 0, _canvasEl.width, _canvasEl.height);
			// and indicate to three.js that the texture needs to be redrawn from the canvas
			_videoTex.needsUpdate = true;
		}
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

	// keystate functions from playercontrols
	onKeyDown(event) {
		if (event.keyCode == 67) {
			this.crazyColors();
		}
		event = event || window.event;
		this.keyState[event.keyCode || event.which] = true;
	}

	onKeyUp(event) {
		event = event || window.event;
		this.keyState[event.keyCode || event.which] = false;
	}

	getPlayerPosition() {
		// TODO: use quaternion or are euler angles fine here?
		return [
			[this.playerGroup.position.x, this.playerGroup.position.y, this.playerGroup.position.z],
			[this.playerGroup.quaternion._x, this.playerGroup.quaternion._y, this.playerGroup.quaternion._z, this.playerGroup.quaternion._w]];
	}
}











// created <video> element for local element
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
	// videoElement.muted = true; // TODO Positional Audio
	videoElement.style = "visibility: hidden;";

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
	rvideoImageCanvas.style = "visibility: hidden;";

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


// TODO
function makePositionalAudioSource(_audioStream) {
	// create the PositionalAudio object (passing in the listener)
	var audioSource = new THREE.PositionalAudio(glScene.listener);
	audioSource.setMediaStreamSource(_audioStream);
	audioSource.setRefDistance(20);
	audioSource.play();
	sound.setVolume(0.5);
	return audioSource;
}