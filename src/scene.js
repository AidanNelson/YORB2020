/* 
* YORB 2020
*
* Aidan Nelson, April 2020
*
*/

// import  * as THREE from 'three';
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';


class Scene {
	constructor(
		domElement = document.getElementById('gl_context'),
		_width = window.innerWidth,
		_height = window.innerHeight,
		clearColor = 'lightblue',
		_movementCallback,
		clientsArr,
		mySocketID) {

		// keep track of 
		this.frameCount = 0;
		this.clients = clientsArr;
		this.mySocketID = mySocketID;

		this.DEBUG_MODE = true;
		this.movementCallback = _movementCallback;

		//THREE scene
		this.scene = new THREE.Scene();
		this.keyState = {};

		//Utility
		this.width = _width;
		// this.width = domElement.width;
		this.height = _height;
		this.stats = new Stats();
		document.body.appendChild(this.stats.dom);

		//Add Player
		this.addSelf();

		// Raycaster
		this.raycaster = new THREE.Raycaster();

		// add lights
		this.addLights();

		//THREE Camera
		this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 5000);
		this.camera.position.set(0, 3, 6);
		this.scene.add(this.camera);

		// create an AudioListener and add it to the camera
		this.listener = new THREE.AudioListener();
		this.playerGroup.add(this.listener);

		//THREE WebGL renderer
		this.renderer = new THREE.WebGLRenderer({
			antialiasing: true
		});
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.setClearColor(new THREE.Color(clearColor));
		this.renderer.setSize(this.width, this.height);


		// Collision Detection Setup!
		this.setupCollisionDetection();

		// add controls:
		this.controls = new THREE.PlayerControls(this.camera, this.playerGroup, document, this.obstacles);
		// TODO adjust speed for lower framerates:
		// this.controls.moveSpeed = 0.2;
		// this.controls.turnSpeed = 0.02;

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

		// Helpers
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
		// add some lights
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
			color: 0xffffe6,
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

	loadModel(_file, _material, _scale, _castShadow, _receiveShadow, _collidable = false) {
		this.GLTFLoader.load(_file, (gltf) => {
			let scene = gltf.scene;
			scene.position.set(0, 0, 0);
			scene.scale.set(_scale, _scale, _scale);
			scene.traverse((child) => {
				if (child.isMesh) {
					child.material = _material;
					child.castShadow = _castShadow;
					child.receiveShadow = _receiveShadow;
					if (_collidable) {
						this.collidableMeshList.push(child);
					}
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
		this.loadModel('models/itp/glass.glb', this.glassMaterial, scaleFactor, false, false, true);
		this.loadModel('models/itp/granite-bar.glb', this.graniteBarMaterial, scaleFactor, true, false, true);
		this.loadModel('models/itp/ibeam.glb', this.paintedMetalMaterial, scaleFactor, true, false, true);
		this.loadModel('models/itp/light-diffuser.glb', this.lightDiffuserMaterial, scaleFactor, false, false);
		this.loadModel('models/itp/light-housing.glb', this.lightHousingMaterial, scaleFactor, false, false);
		this.loadModel('models/itp/lighting-grid.glb', this.wallMaterial, scaleFactor, false, false);
		this.loadModel('models/itp/walls.glb', this.wallMaterial, scaleFactor, true, false, true);
		this.loadModel('models/itp/window-shelf.glb', this.windowShelfMaterial, scaleFactor, true, false);
		this.loadModel('models/itp/wooden-bar.glb', this.floorMaterial, scaleFactor, true, true, true);
	}

	//////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////
	// Clients 👫

	addSelf() {
		let _body = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			new THREE.MeshNormalMaterial()
		);

		let [videoTexture, videoMaterial] = this.makeVideoTextureAndMaterial("local");

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

		let [videoTexture, videoMaterial] = this.makeVideoTextureAndMaterial(_id);

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

		console.log("Adding client to scene: " + _id);

		this.clients[_id].group = group;
		this.clients[_id].texture = videoTexture;
		this.clients[_id].desiredPosition = new THREE.Vector3();
		this.clients[_id].desiredRotation = new THREE.Quaternion();
		this.clients[_id].oldPos = group.position
		this.clients[_id].oldRot = group.quaternion;
		this.clients[_id].movementAlpha = 0;
	}

	removeClient(_id) {
		this.scene.remove(this.clients[_id].group);
	}

	// overloaded function can deal with new info or not
	updateClientPositions(_clientProps) {

		for (let _id in _clientProps) {
			// we'll update ourselves separately to avoid lag...
			if (_id in this.clients) {
				if (_id != this.mySocketID) {
					this.clients[_id].desiredPosition = new THREE.Vector3().fromArray(_clientProps[_id].position);
					this.clients[_id].desiredRotation = new THREE.Quaternion().fromArray(_clientProps[_id].rotation)
				}
			}
		}
	}

	// TODO make this simpler...? more performant?
	updatePositions() {
		let snapDistance = 0.5;
		let snapAngle = 0.2; // radians
		for (let _id in this.clients) {
			if (this.clients[_id].group) {
				this.clients[_id].group.position.lerp(this.clients[_id].desiredPosition, 0.2);
				this.clients[_id].group.quaternion.slerp(this.clients[_id].desiredRotation, 0.2);
				if (this.clients[_id].group.position.distanceTo(this.clients[_id].desiredPosition) < snapDistance) {
					this.clients[_id].group.position.set(this.clients[_id].desiredPosition.x, this.clients[_id].desiredPosition.y, this.clients[_id].desiredPosition.z);
				}
				if (this.clients[_id].group.quaternion.angleTo(this.clients[_id].desiredRotation) < snapAngle) {
					this.clients[_id].group.quaternion.set(this.clients[_id].desiredRotation.x, this.clients[_id].desiredRotation.y, this.clients[_id].desiredRotation.z, this.clients[_id].desiredRotation.w);
				}
			}
		}
	}

	//////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////
	// Interaction 🤾‍♀️


	setupCollisionDetection() {
		this.numCollisionDetectionPoints = 4 * 4;

		// get the headMesh vertices
		// var headMeshVertices = this.playerGroup.children[1].geometry.vertices;

		// these are the four vertices of each side:
		// var forwardVertices = [headMeshVertices[1], headMeshVertices[3], headMeshVertices[4], headMeshVertices[6]];
		// var backwardVertices = [headMeshVertices[0], headMeshVertices[2], headMeshVertices[5], headMeshVertices[7]];
		// var rightVertices = [headMeshVertices[0], headMeshVertices[1], headMeshVertices[2], headMeshVertices[3]];
		// var leftVertices = [headMeshVertices[4], headMeshVertices[5], headMeshVertices[6], headMeshVertices[7]]

		this.collidableMeshList = [];

		this.obstacles = {
			forward: false,
			backward: false,
			right: false,
			left: false
		}

		// vertex indices discovered by manual labor...
		var headMeshVertices = this.playerGroup.children[1].geometry.vertices;
		var numPoints = this.numCollisionDetectionPoints / 4;

		this.forwardCollisionDetectionPoints = this.getPointsBetweenPoints(headMeshVertices[6], headMeshVertices[3], numPoints);
		this.backwardCollisionDetectionPoints = this.getPointsBetweenPoints(headMeshVertices[2], headMeshVertices[7], numPoints);
		this.rightCollisionDetectionPoints = this.getPointsBetweenPoints(headMeshVertices[3], headMeshVertices[2], numPoints);
		this.leftCollisionDetectionPoints = this.getPointsBetweenPoints(headMeshVertices[7], headMeshVertices[6], numPoints);

		// for use debugging collision detection
		if (this.DEBUG_MODE) {
			this.collisionDetectionDebugArrows = [];
			for (let i = 0; i < this.numCollisionDetectionPoints; i++) {
				var arrow = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(), 1, 0x000000)
				this.collisionDetectionDebugArrows.push(arrow)
				this.scene.add(arrow)
			}
		}
	}

	// https://stackoverflow.com/questions/21249739/how-to-calculate-the-points-between-two-given-points-and-given-distance
	// returns an array of vectors from A to B, including A and B
	getPointsBetweenPoints(vecA, vecB, numPoints) {
		var points = [];
		var dirVec = vecB.clone().sub(vecA);
		for (let i = 0; i < numPoints; i++) {
			var pt = vecA.clone().add(dirVec.clone().multiplyScalar(i / (numPoints - 1)));
			points.push(pt)
		}
		return points;
	}


	detectCollisionsWalls() {
		// reset obstacles: 
		this.obstacles = {
			forward: false,
			backward: false,
			right: false,
			left: false
		}

		// for debugging:
		var arrowHelperOffset = 0;

		// distance at which a collision will be detected and movement stopped (this should be greater than the movement speed per frame...)
		var detectCollisionDistance = 1;

		// NOTE: THREE.PlayerControls seems to be backwards (i.e. the 'forward' controls go backwards)... 
		// Weird, but this function respects those directions for the sake of not having to make conversions
		// https://github.com/mrdoob/three.js/issues/1606
		var matrix = new THREE.Matrix4();
		matrix.extractRotation(this.playerGroup.matrix);
		var backwardDir = new THREE.Vector3(0, 0, 1).applyMatrix4(matrix);
		var forwardDir = backwardDir.clone().negate();
		var rightDir = forwardDir.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
		var leftDir = rightDir.clone().negate();


		// check forward
		for (var vertexIndex = 0; vertexIndex < this.forwardCollisionDetectionPoints.length; vertexIndex++) {

			var vertex = this.forwardCollisionDetectionPoints[vertexIndex].clone();
			vertex.applyMatrix4(this.playerGroup.matrix);
			vertex.y += 1.0; // bias upward to head area of player

			this.raycaster.set(vertex, forwardDir);
			var collisions = this.raycaster.intersectObjects(this.collidableMeshList);

			// arrow helpers for debugging
			if (this.DEBUG_MODE) {
				var a = this.collisionDetectionDebugArrows[vertexIndex + arrowHelperOffset];
				a.setLength(detectCollisionDistance);
				a.setColor(new THREE.Color("rgb(0, 0, 255)"));
				a.position.x = vertex.x;
				a.position.y = vertex.y;
				a.position.z = vertex.z;
				a.setDirection(forwardDir);
			}

			if (collisions.length > 0 && collisions[0].distance < detectCollisionDistance) {
				if (this.DEBUG_MODE) {
					console.log("Forward hit on vertex " + vertexIndex + "!");
				}
				this.obstacles.forward = true;
			}
		}

		// check backward
		arrowHelperOffset += 4;
		for (var vertexIndex = 0; vertexIndex < this.backwardCollisionDetectionPoints.length; vertexIndex++) {

			var vertex = this.backwardCollisionDetectionPoints[vertexIndex].clone();
			vertex.applyMatrix4(this.playerGroup.matrix);
			vertex.y += 1.0; // bias upward to head area of player

			this.raycaster.set(vertex, backwardDir);
			var collisions = this.raycaster.intersectObjects(this.collidableMeshList);

			// arrow helpers for debugging
			if (this.DEBUG_MODE) {
				var a = this.collisionDetectionDebugArrows[vertexIndex + arrowHelperOffset];
				a.setLength(detectCollisionDistance);
				a.setColor(new THREE.Color("rgb(0, 255, 255)"));
				a.position.x = vertex.x;
				a.position.y = vertex.y;
				a.position.z = vertex.z;
				a.setDirection(backwardDir);
			}

			if (collisions.length > 0 && collisions[0].distance < detectCollisionDistance) {
				if (this.DEBUG_MODE) { console.log("Backward hit on vertex " + vertexIndex + "!"); }
				this.obstacles.backward = true;
			}
		}

		// check right
		arrowHelperOffset += 4;
		for (var vertexIndex = 0; vertexIndex < this.rightCollisionDetectionPoints.length; vertexIndex++) {

			var vertex = this.rightCollisionDetectionPoints[vertexIndex].clone();
			vertex.applyMatrix4(this.playerGroup.matrix);
			vertex.y += 1.0; // bias upward to head area of player

			this.raycaster.set(vertex, rightDir);
			var collisions = this.raycaster.intersectObjects(this.collidableMeshList);

			// arrow helpers for debugging
			if (this.DEBUG_MODE) {
				var a = this.collisionDetectionDebugArrows[vertexIndex + arrowHelperOffset];
				a.setLength(detectCollisionDistance);
				a.setColor(new THREE.Color("rgb(255, 255, 0)"));
				a.position.x = vertex.x;
				a.position.y = vertex.y;
				a.position.z = vertex.z;
				a.setDirection(rightDir);
			}

			if (collisions.length > 0 && collisions[0].distance < detectCollisionDistance) {
				if (this.DEBUG_MODE) {
					console.log("Right hit on vertex " + vertexIndex + "!");
				}
				this.obstacles.right = true;
			}
		}

		// check left
		arrowHelperOffset += 4;
		for (var vertexIndex = 0; vertexIndex < this.leftCollisionDetectionPoints.length; vertexIndex++) {

			var vertex = this.leftCollisionDetectionPoints[vertexIndex].clone();
			vertex.applyMatrix4(this.playerGroup.matrix);
			vertex.y += 1.0; // bias upward to head area of player

			this.raycaster.set(vertex, leftDir);
			var collisions = this.raycaster.intersectObjects(this.collidableMeshList);

			// arrow helpers for debugging
			if (this.DEBUG_MODE) {
				var a = this.collisionDetectionDebugArrows[vertexIndex + arrowHelperOffset];
				a.setLength(detectCollisionDistance);
				a.setColor(new THREE.Color("rgb(255, 0, 0)"));
				a.position.x = vertex.x;
				a.position.y = vertex.y;
				a.position.z = vertex.z;
				a.setDirection(leftDir);
			}

			if (collisions.length > 0 && collisions[0].distance < detectCollisionDistance) {
				if (this.DEBUG_MODE) {
					console.log("Left hit on vertex " + vertexIndex + "!");
				}
				this.obstacles.left = true;
			}
		}

		this.controls.obstacles = this.obstacles;
	}

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

	//https://github.com/stemkoski/stemkoski.github.com/blob/master/Three.js/Collision-Detection.html
	detectCollisions() {
		// https://github.com/mrdoob/three.js/issues/1606
		var matrix = new THREE.Matrix4();
		matrix.extractRotation(this.playerGroup.matrix);

		var dirVec = new THREE.Vector3(0, 1, 0);
		dirVec = new THREE.Vector3(0, 0, 1).applyMatrix4(matrix);
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

		// FPS monitor for debugging:
		if (this.DEBUG_MODE) {
			this.stats.update();
		}

		// send movement stats to the socket server if any of the keys have been pressed
		let sendStats = false;
		for (let i in this.keyState) {
			if (this.keyState[i]) {
				sendStats = true;
				break;
			}
		}
		if (sendStats) { this.movementCallback(); }

		this.frameCount++;
		if (this.frameCount % 10 == 0) {
			this.updateClientVolumes();
		}

		this.updatePositions();
		this.detectCollisions();

		this.detectCollisionsWalls();

		this.controls.update();

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
		if (localVideo != null && localVideoCanvas != null) {
			this.redrawVideoCanvas(localVideo, localVideoCanvas, this.playerVideoTexture)
		}


		for (let _id in this.clients) {
			let remoteVideo = document.getElementById(_id + "_video");
			let remoteVideoCanvas = document.getElementById(_id + "_canvas");
			if (remoteVideo != null && remoteVideoCanvas != null) {
				this.redrawVideoCanvas(remoteVideo, remoteVideoCanvas, this.clients[_id].texture);
			}
		}
	}

	updateClientVolumes() {
		let distanceThresholdSquared = 800; // over this distance, no sound is heard
		// let rolloffFactor = 10;
		let numerator = 50; // TODO rename this

		for (let _id in this.clients) {
			if (this.clients[_id].audioElement) {
				let distSquared = this.playerGroup.position.distanceToSquared(this.clients[_id].group.position);
				if (distSquared > distanceThresholdSquared) {
					// TODO pause consumer here, rather than setting volume to zero
					this.clients[_id].audioElement.volume = 0;
				} else {
					// from lucasio here: https://discourse.threejs.org/t/positionalaudio-setmediastreamsource-with-webrtc-question-not-hearing-any-sound/14301/29

					let volume = Math.min(1, numerator / distSquared);
					this.clients[_id].audioElement.volume = volume;
				}
			}
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
		this.controls.enabled = false;
	}
	// TODO deal with issue where re-entering canvas between keydown and key-up causes 
	// controls to be stuck on
	onEnterCanvas(e) {
		this.controls.enabled = true;
	}

	// keystate functions from playercontrols
	onKeyDown(event) {
		event = event || window.event;
		this.keyState[event.keyCode || event.which] = true;
	}

	onKeyUp(event) {
		event = event || window.event;
		this.keyState[event.keyCode || event.which] = false;
	}

	//////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////
	// Utilities 🚂

	// Adapted from: https://github.com/zacharystenger/three-js-video-chat
	makeVideoTextureAndMaterial(_id) {
		// create a canvas and add it to the body
		let rvideoImageCanvas = document.createElement('canvas');
		document.body.appendChild(rvideoImageCanvas);

		rvideoImageCanvas.id = _id + "_canvas";
		// rvideoImageCanvas.width = videoWidth;
		// rvideoImageCanvas.height = videoHeight;
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


	// TODO check this
	createOrUpdatePositionalAudio(_id) {
		let audioElement = document.getElementById(_id + "_audio");
		if (audioElement == null) {
			console.log("No audio element found for user with ID: " + _id);
			return;
		}
		this.clients[_id].audioElement = audioElement;
		console.log("The following audio element attached to client with ID " + _id + ":");
		console.log(this.clients[_id].audioElement);
		// let audioSource;	
		// if (this.clients[_id]) {
		// 	if ("positionalAudioSource" in this.clients[_id]) {
		// 		audioSource = this.clients[_id].positionalAudioSource;
		// 		this.scene.remove(audioSource);
		// 	}

		// 	audioSource = new THREE.PositionalAudio(this.listener);
		// 	audioSource.setRefDistance(10);
		// 	audioSource.setRolloffFactor(10);
		// 	audioSource.setVolume(1);
		// 	this.clients[_id].positionalAudioSource = audioSource;
		// 	this.clients[_id].group.add(audioSource);

		// 	// audioSource.setMediaStreamSource(_audioStream);
		// 	audioSource.setMediaElementSource(audioElement);
		// 	console.log(audioSource);
		// }
	}
}

export default Scene;