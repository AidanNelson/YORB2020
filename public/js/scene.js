/* 
* YORB 2020
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
		this.keyState = {};

		//Utility
		this.width = _width;
		this.height = _height;
		this.stats = new Stats();
		domElement.appendChild(this.stats.dom);

		// crazy colors:
		this.crazyMode = false;
		this.originalFloorMaterials = [];

		//Add Player
		this.addSelf();

		// Raycaster
		this.raycaster = new THREE.Raycaster();

		// add lights
		this.addLights();

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
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.setClearColor(new THREE.Color(clearColor));
		this.renderer.setSize(this.width, this.height);

		// add controls:
		// https://github.com/PiusNyakoojo/PlayerControls
		this.controls = new THREE.PlayerControls(this.camera, this.playerGroup);

		// array to store interactable hyperlinked meshes
		this.hyperlinkedObjects = [];
		// proof of concept hyperlink
		this.createHyperlinkedMesh(-25, 0, -15, "http://www.example.com");

		// environment map from three.js examples
		this.loadBackground();

		// load floor model
		this.createMaterials();
		this.loadFloorModel();

		//Push the canvas to the DOM
		domElement.append(this.renderer.domElement);

		//Setup event listeners for events and handle the states
		window.addEventListener('resize', e => this.onWindowResize(e), false);
		domElement.addEventListener('mouseenter', e => this.onEnterCanvas(e), false);
		domElement.addEventListener('mouseleave', e => this.onLeaveCanvas(e), false);
		window.addEventListener('keydown', e => this.onKeyDown(e), false);
		window.addEventListener('keyup', e => this.onKeyUp(e), false);

		this.helperGrid = new THREE.GridHelper(500, 500);
		this.helperGrid.position.y = -0.1; // offset the grid down to avoid z fighting with floor
		this.scene.add(this.helperGrid);

		this.scene.add(new THREE.AxesHelper(10));

		this.update();
	}


	//////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////
	// Lighting 💡

	addLights() {
		/ add some lights/
		this.scene.add(new THREE.AmbientLight(0xffffe6, 0.7));

		//https://github.com/mrdoob/three.js/blob/master/examples/webgl_lights_hemisphere.html
		// main sunlight with shadows
		let dirLight = new THREE.DirectionalLight(0xffffe6, 0.7);
		dirLight.color.setHSL(0.1, 1, 0.95);
		dirLight.position.set(- 1, 0.5, -1);
		dirLight.position.multiplyScalar(200);
		this.scene.add(dirLight);

		dirLight.castShadow = true;
		dirLight.shadow.mapSize.width = 1024;
		dirLight.shadow.mapSize.height = 1024;

		var d = 150;
		dirLight.shadow.camera.left = - d;
		dirLight.shadow.camera.right = d;
		dirLight.shadow.camera.top = d;
		dirLight.shadow.camera.bottom = - d;

		dirLight.shadow.camera.far = 3500;
		dirLight.shadow.bias = - 0.0001;

		let dirLightHeper = new THREE.DirectionalLightHelper(dirLight, 10);
		this.scene.add(dirLightHeper);

		// secondary directional light without shadows:
		let dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
		dirLight2.color.setHSL(0.1, 1, 0.95);
		dirLight2.position.set(1, 0.5, -1);
		dirLight2.position.multiplyScalar(200);
		this.scene.add(dirLight2);
	}

	//////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////
	// Model 🏗

	loadBackground() {
		var path = 'models/Park2/';
		var format = '.jpg';
		this.envMap = new THREE.CubeTextureLoader().load([
			path + 'posx' + format, path + 'negx' + format,
			path + 'posy' + format, path + 'negy' + format,
			path + 'posz' + format, path + 'negz' + format
		]);
		this.scene.background = this.envMap;
	}

	// this method instantiates materials for various parts of the ITP floor model
	// wall, ceiling, floor
	createMaterials() {
		this.testMaterial = new THREE.MeshLambertMaterial({ color: 0xffff1a });

		let paintedRoughnessTexture = new THREE.TextureLoader().load("textures/roughness.jpg");
		paintedRoughnessTexture.wrapS = THREE.RepeatWrapping;
		paintedRoughnessTexture.wrapT = THREE.RepeatWrapping;
		paintedRoughnessTexture.repeat.set(5, 5);

		// wall material:
		this.wallMaterial = new THREE.MeshPhongMaterial({
			color: 0xfffff5,
			bumpMap: paintedRoughnessTexture,
			bumpScale: 0.25,
			specular: 0xfffff5,
			reflectivity: 0.01,
			shininess: 0.1,
			envMap: null
		});

		// ceiling material
		this.ceilingMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

		// floor material
		// https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_variations_phong.html
		let floorTexture = new THREE.TextureLoader().load("textures/floor.jpg");
		floorTexture.wrapS = THREE.RepeatWrapping;
		floorTexture.wrapT = THREE.RepeatWrapping;
		floorTexture.repeat.set(1, 1);

		this.floorMaterial = new THREE.MeshPhongMaterial({
			color: 0xffffff,
			map: floorTexture,
			bumpMap: floorTexture,
			bumpScale: 0.005,
			specular: 0xffffff,
			reflectivity: 0.5,
			shininess: 4,
			envMap: null
		});

		this.paintedMetalMaterial = new THREE.MeshPhongMaterial({
			color: 0x1a1a1a,
			bumpMap: paintedRoughnessTexture,
			bumpScale: 0.2,
			specular: 0xffffff,
			reflectivity: 0.01,
			shininess: 1,
			envMap: null
		});

		this.windowShelfMaterial = new THREE.MeshPhongMaterial({
			color: 0xdddddd
		});

		// https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_physical_transparency.html
		this.glassMaterial = new THREE.MeshPhysicalMaterial({
			color: 0xD9ECFF,
			metalness: 0.05,
			roughness: 0,
			alphaTest: 0.5,
			depthWrite: false,
			envMap: this.envMap,
			envMapIntensity: 1,
			transparency: 1, // use material.transparency for glass materials
			opacity: 1,                        // set material.opacity to 1 when material.transparency is non-zero
			transparent: true
		});

		this.lightHousingMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });

		this.lightDiffuserMaterial = new THREE.MeshPhongMaterial({
			color: 0xcccccc,
			emissive: 0xffffff,
			emissiveIntensity: 10,
			specular: 0xffffff,
			reflectivity: 0.01,
			shininess: 1,
			envMap: null
		});

		this.glassFixturingMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });

		this.graniteBarMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
	}

	loadModel(_file, _material, _scale, _castShadow, _receiveShadow) {
		this.GLTFLoader.load(_file, (gltf) => {
			let scene = gltf.scene;
			scene.position.set(0, 0, 0);
			scene.scale.set(_scale, _scale, _scale);
			scene.traverse((child) => {
				if (child.isMesh) {
					child.material = _material;
					child.castShadow = _castShadow;
					child.receiveShadow = _receiveShadow;
				}
			});
			this.scene.add(scene);
		}, undefined, function (e) {
			console.error(e);
		});
	}

	loadFloorModel() {
		this.GLTFLoader = new THREE.GLTFLoader();
		let scaleFactor = 2;

		this.loadModel('models/itp/ceiling.glb', this.ceilingMaterial, scaleFactor, true, false);
		this.loadModel('models/itp/floor.glb', this.floorMaterial, scaleFactor, false, true);
		this.loadModel('models/itp/glass-fixturing.glb', this.glassFixturingMaterial, scaleFactor, true, false);
		this.loadModel('models/itp/glass.glb', this.glassMaterial, scaleFactor, false, false);
		this.loadModel('models/itp/granite-bar.glb', this.graniteBarMaterial, scaleFactor, true, false);
		this.loadModel('models/itp/ibeam.glb', this.paintedMetalMaterial, scaleFactor, true, false);
		this.loadModel('models/itp/light-diffuser.glb', this.lightDiffuserMaterial, scaleFactor, false, false);
		this.loadModel('models/itp/light-housing.glb', this.lightHousingMaterial, scaleFactor, false, false);
		this.loadModel('models/itp/lighting-grid.glb', this.wallMaterial, scaleFactor, false, false);
		this.loadModel('models/itp/walls.glb', this.wallMaterial, scaleFactor, true, false);
		this.loadModel('models/itp/window-shelf.glb', this.windowShelfMaterial, scaleFactor, true, false);
		this.loadModel('models/itp/wooden-bar.glb', this.floorMaterial, scaleFactor, true, true);
	}

	//////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////
	// Clients 👫

	addSelf() {
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

	//////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////
	// Interaction 🤾‍♀️

	createHyperlinkedMesh(x, y, z, url) {
		// load a image resource
		let tex = new THREE.TextureLoader().load('images/grid.jpg');

		var geometry = new THREE.CylinderGeometry(1, 1, 8, 32);
		var material = new THREE.MeshBasicMaterial({ map: tex, color: 0xffff00 });
		var mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(x, y, z);

		// https://stackoverflow.com/questions/24690731/three-js-3d-models-as-hyperlink/24692057
		mesh.userData = { URL: url };
		this.hyperlinkedObjects.push(mesh);
		this.scene.add(mesh);
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
		var intersects = this.raycaster.intersectObjects(this.hyperlinkedObjects);

		if (intersects.length > 0) {
			for (let i = 0; i < intersects.length; i++) {
				if (intersects[i].distance < 1) {
					console.log("Approaching obstacle!");
					console.log(intersects[i].object.userData.URL);
					if (!intersects[i].object.userData.linkVisited) {
						// open some sort of modal asking users if they wish to enter zoom link...
						window.open(intersects[i].object.userData.URL);
						intersects[i].object.userData.linkVisited = true
					}
				}
			}
		}
		// }
	}

	getPlayerPosition() {
		// TODO: use quaternion or are euler angles fine here?
		return [
			[this.playerGroup.position.x, this.playerGroup.position.y, this.playerGroup.position.z],
			[this.playerGroup.quaternion._x, this.playerGroup.quaternion._y, this.playerGroup.quaternion._z, this.playerGroup.quaternion._w]];
	}

	//////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////
	// Rendering 🎥

	update() {
		requestAnimationFrame(() => this.update());

		// send movement stats to the socket server if any of the keys are pressed
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
		this.stats.update();
		this.render();
	}

	render() {
		// Update video canvases for each client
		this.updateVideoTextures();
		this.renderer.render(this.scene, this.camera);
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

	//////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////
	// Event Handlers 🍽

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