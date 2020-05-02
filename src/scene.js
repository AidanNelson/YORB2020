/* 
* YORB 2020
*
* Aidan Nelson, April 2020
*
*/

import { pauseAllConsumersForPeer, resumeAllConsumersForPeer } from './index.js'

const THREE = require('./libs/three.min.js');

// slightly awkward syntax, but these statements add these functions to THREE
require('./libs/GLTFLoader.js')(THREE);
// require('./libs/playerControls.js')(THREE);
// require('./libs/fpscontrols.js')(THREE);
require('./libs/pointerLockControls.js')(THREE);

const Stats = require('./libs/stats.min.js');

class Scene {
	constructor(
		domElement = document.getElementById('gl_context'),
		_movementCallback,
		clientsArr,
		mySocketID) {

		this.clock = new THREE.Clock();


		// keep track of 
		this.frameCount = 0;
		this.clients = clientsArr;
		this.mySocketID = mySocketID;

		this.DEBUG_MODE = false;
		this.movementCallback = _movementCallback;

		//THREE scene
		this.scene = new THREE.Scene();
		this.keyState = {};

		//Utility
		this.width = (window.innerWidth * 0.9);
		this.height = (window.innerHeight * 0.8);


		this.stats = new Stats();
		document.body.appendChild(this.stats.dom);


		//Add Player
		// this.addSelf();

		this.loadFont();

		// Raycaster
		this.raycaster = new THREE.Raycaster();

		// add lights
		this.addLights();

		//THREE Camera
		this.cameraHeight = 1.5;
		this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 5000);
		this.camera.position.set(0, this.cameraHeight, 0);
		// create an AudioListener and add it to the camera
		this.listener = new THREE.AudioListener();
		this.camera.add(this.listener);
		this.scene.add(this.camera);
		window.camera = this.camera;

		//THREE WebGL renderer
		this.renderer = new THREE.WebGLRenderer({
			antialiasing: true
		});
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.setClearColor(new THREE.Color('lightblue'));
		this.renderer.setSize(this.width, this.height);

		this.setupCollisionDetection();
		this.setupControls();

		// array to store interactable hyperlinked meshes
		this.hyperlinkedObjects = [];

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


	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
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

		// let dirLightHeper = new THREE.DirectionalLightHelper(dirLight, 10);
		// this.scene.add(dirLightHeper);

		// secondary directional light without shadows:
		let dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
		dirLight2.color.setHSL(0.1, 1, 0.95);
		dirLight2.position.set(1, 0.5, -1);
		dirLight2.position.multiplyScalar(200);
		this.scene.add(dirLight2);
	}

	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
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
		let scaleFactor = 4;

		this.loadModel('models/itp/ceiling.glb', this.ceilingMaterial, scaleFactor, true, false);
		this.loadModel('models/itp/floor.glb', this.floorMaterial, scaleFactor, false, true, true);
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

	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
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

		_head.visible = false; // for first person

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
		// this.clients[_id].desiredRotation = new THREE.Quaternion();
	}

	removeClient(_id) {
		this.scene.remove(this.clients[_id].group);
	}

	// overloaded function can deal with new info or not
	updateClientPositions(_clientProps) {
		let halfClientHeight = 1;

		for (let _id in _clientProps) {
			// we'll update ourselves separately to avoid lag...
			if (_id in this.clients) {
				if (_id != this.mySocketID) {
					this.clients[_id].desiredPosition = new THREE.Vector3(_clientProps[_id].position[0], _clientProps[_id].position[1], _clientProps[_id].position[2]);
					// this.clients[_id].desiredRotation = new THREE.Quaternion().fromArray(_clientProps[_id].rotation)
					let euler = new THREE.Euler(0, _clientProps[_id].rotation[1], 0, 'XYZ');
					this.clients[_id].group.setRotationFromEuler(euler);
				}
			}
		}
	}

	// TODO make this simpler...? more performant?
	updatePositions() {
		let snapDistance = 0.5;
		// let snapAngle = 0.2; // radians
		for (let _id in this.clients) {
			if (this.clients[_id].group) {
				this.clients[_id].group.position.lerp(this.clients[_id].desiredPosition, 0.2);
				if (this.clients[_id].group.position.distanceTo(this.clients[_id].desiredPosition) < snapDistance) {
					this.clients[_id].group.position.set(this.clients[_id].desiredPosition.x, this.clients[_id].desiredPosition.y, this.clients[_id].desiredPosition.z);
				}

				// this.clients[_id].group.quaternion.slerp(this.clients[_id].desiredRotation, 0.2);
				// if (this.clients[_id].group.quaternion.angleTo(this.clients[_id].desiredRotation) < snapAngle) {
				// 	this.clients[_id].group.quaternion.set(this.clients[_id].desiredRotation.x, this.clients[_id].desiredRotation.y, this.clients[_id].desiredRotation.z, this.clients[_id].desiredRotation.w);
				// }
			}
		}
	}

	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	// Collision Detection 🤾‍♀️

	/*
	* setupCollisionDetection()
	*
	* Description:
	* This function sets up collision detection:
	* 	- creates this.collidableMeshList which will be populated by this.loadFloorModel function
	* 	- creates this.obstacles object which will be queried by player controls before performing movement
	* 	- generates arrays of collision detection points, from which we will perform raycasts in this.detectCollisions()
	*
	*/
	setupCollisionDetection() {
		this.collidableMeshList = [];

		this.obstacles = {
			forward: false,
			backward: false,
			right: false,
			left: false
		}

		// var numCollisionDetectionPointsPerSide = 3;
		// var numTotalCollisionDetectionPoints = numCollisionDetectionPointsPerSide * 4;

		// get the headMesh vertices
		// var headMeshVertices = this.playerGroup.children[1].geometry.vertices;

		// these are the four vertices of each side:
		// figured out which ones were which with pen and paper...
		// var forwardVertices = [headMeshVertices[1], headMeshVertices[3], headMeshVertices[4], headMeshVertices[6]];
		// var backwardVertices = [headMeshVertices[0], headMeshVertices[2], headMeshVertices[5], headMeshVertices[7]];
		// var rightVertices = [headMeshVertices[0], headMeshVertices[1], headMeshVertices[2], headMeshVertices[3]];
		// var leftVertices = [headMeshVertices[4], headMeshVertices[5], headMeshVertices[6], headMeshVertices[7]]

		// this.forwardCollisionDetectionPoints = this.getPointsBetweenPoints(headMeshVertices[6], headMeshVertices[3], numCollisionDetectionPointsPerSide);
		// this.backwardCollisionDetectionPoints = this.getPointsBetweenPoints(headMeshVertices[2], headMeshVertices[7], numCollisionDetectionPointsPerSide);
		// this.rightCollisionDetectionPoints = this.getPointsBetweenPoints(headMeshVertices[3], headMeshVertices[2], numCollisionDetectionPointsPerSide);
		// this.leftCollisionDetectionPoints = this.getPointsBetweenPoints(headMeshVertices[7], headMeshVertices[6], numCollisionDetectionPointsPerSide);

		// for use debugging collision detection
		if (this.DEBUG_MODE) {
			this.collisionDetectionDebugArrows = [];
			for (let i = 0; i < numTotalCollisionDetectionPoints; i++) {
				var arrow = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(), 1, 0x000000)
				this.collisionDetectionDebugArrows.push(arrow)
				this.scene.add(arrow)
			}
		}
	}

	/*
	* getPointsBetweenPoints()
	*
	* Description:
	* Returns an array of numPoints THREE.Vector3 objects evenly spaced between vecA and vecB, including vecA and vecB
	* 
	* based on:
	* https://stackoverflow.com/questions/21249739/how-to-calculate-the-points-between-two-given-points-and-given-distance
	*
	*/
	getPointsBetweenPoints(vecA, vecB, numPoints) {
		var points = [];
		var dirVec = vecB.clone().sub(vecA);
		for (let i = 0; i < numPoints; i++) {
			var pt = vecA.clone().add(dirVec.clone().multiplyScalar(i / (numPoints - 1)));
			points.push(pt)
		}
		return points;
	}


	/*
	* detectCollisions()
	*
	* based on method shown here: 
	* https://github.com/stemkoski/stemkoski.github.com/blob/master/Three.js/Collision-Detection.html
	*
	* Description:
	* 1. Creates THREE.Vector3 objects representing the current forward, left, right, backward direction of the character.
	* 2. For each side of the cube, 
	* 		- uses the collision detection points created in this.setupCollisionDetection()
	*		- sends a ray out from each point in the direction set up above 
	* 		- if any one of the rays hits an object, set this.obstacles.SIDE (i.e. right or left) to true
	* 3. Give this.obstacles object to this.controls
	*
	* To Do: setup helper function to avoid repetitive code
	*/
	detectCollisions() {
		// reset obstacles: 
		this.obstacles = {
			forward: false,
			backward: false,
			right: false,
			left: false
		}


		// TODO only use XZ components of forward DIR in case we are looking up or down while travelling forward
		// NOTE: THREE.PlayerControls seems to be backwards (i.e. the 'forward' controls go backwards)... 
		// Weird, but this function respects those directions for the sake of not having to make conversions
		// https://github.com/mrdoob/three.js/issues/1606
		var matrix = new THREE.Matrix4();
		matrix.extractRotation(this.camera.matrix);
		var backwardDir = new THREE.Vector3(0, 0, 1).applyMatrix4(matrix);
		var forwardDir = backwardDir.clone().negate();
		var rightDir = forwardDir.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
		var leftDir = rightDir.clone().negate();

		// let forwardDir = new THREE.Vector3();
		// this.controls.getDirection(forwardDir);
		// var backwardDir = forwardDir.clone().negate();
		// var rightDir = forwardDir.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
		// var leftDir = rightDir.clone().negate();

		// TODO more points around avatar so we can't be inside of walls
		let pt = this.controls.getObject().position.clone();

		this.forwardCollisionDetectionPoints = [pt];
		this.backwardCollisionDetectionPoints = [pt];
		this.rightCollisionDetectionPoints = [pt];
		this.leftCollisionDetectionPoints = [pt];



		// check forward
		this.obstacles.forward = this.checkCollisions(this.forwardCollisionDetectionPoints, forwardDir, 0);
		this.obstacles.backward = this.checkCollisions(this.backwardCollisionDetectionPoints, backwardDir, 4);
		this.obstacles.left = this.checkCollisions(this.leftCollisionDetectionPoints, leftDir, 8);
		this.obstacles.right = this.checkCollisions(this.rightCollisionDetectionPoints, rightDir, 12);

		// this.controls.obstacles = this.obstacles;
	}

	checkCollisions(pts, dir, arrowHelperOffset) {
		// distance at which a collision will be detected and movement stopped (this should be greater than the movement speed per frame...)
		var detectCollisionDistance = 1;

		for (var i = 0; i < pts.length; i++) {

			var pt = pts[i].clone();
			// pt.applyMatrix4(this.playerGroup.matrix);
			// pt.y += 1.0; // bias upward to head area of player

			this.raycaster.set(pt, dir);
			var collisions = this.raycaster.intersectObjects(this.collidableMeshList);

			// arrow helpers for debugging
			if (this.DEBUG_MODE) {
				var a = this.collisionDetectionDebugArrows[i + arrowHelperOffset];
				a.setLength(detectCollisionDistance);
				a.setColor(new THREE.Color("rgb(0, 0, 255)"));
				a.position.x = pt.x;
				a.position.y = pt.y;
				a.position.z = pt.z;
				a.setDirection(dir);
			}

			if (collisions.length > 0 && collisions[0].distance < detectCollisionDistance) {
				return true;
			}
		}
		return false;
	}
	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	// Interactable Hyperlinks for Spring Show 💎

	/*
	* updateProjects(projects) 
	*
	* Description:
	* 	- empties out the existing projects array and any existing hyperlink objects within it
	* 	- creates XYZ locations for each of the new project hyperlinks
	* 	- calls this.createHyperlinkedMesh for each project in the projects array
	* 	- places returned objects in this.hyperlinkedObjects array and adds them to the scene
	*
	*/
	updateProjects(projects) {

		// first, empty the project
		for (let i = 0; i < this.hyperlinkedObjects.length; i++) {
			this.scene.remove(this.hyperlinkedObjects[i]);
		}
		for (let i = 0; i < projects.length; i++) {
			let project = projects[i];
			let locX = -70;
			let locZ = i * -10 + 40;
			let hyperlink = this.createHyperlinkedMesh(locX, 0, locZ, project);
			this.hyperlinkedObjects.push(hyperlink);
			this.scene.add(hyperlink);
		}
	}

	/*
	* createHyperlinkedMesh(x,y,z,_project) 
	*
	* Description:
	* 	- creates an object3D for each project at position x,y,z 
	*	- adds _project as userData to the object3D
	*	- returns object3D
	*/
	createHyperlinkedMesh(x, y, z, _project) {
		// load a image resource
		let tex = new THREE.TextureLoader().load('images/grid.jpg');

		var geometry = new THREE.CylinderGeometry(1, 1, 8, 32);
		var material = new THREE.MeshBasicMaterial({ map: tex, color: 0xffff00 });
		var mesh = new THREE.Mesh(geometry, material);

		let textMesh = this.createText(_project.project_name, 1, 0.5, 4, 0.1, 0.1, false);
		// textMesh.position.x += x;
		// textMesh.position.y += y
		// textMesh.position.z += z;
		// this.scene.add(textMesh);
		mesh.add(textMesh)
		mesh.position.set(x, y, z);



		// https://stackoverflow.com/questions/24690731/three-js-3d-models-as-hyperlink/24692057
		mesh.userData = {
			project: _project
		}
		return mesh;
	}

	/*
	* generateProjectModal(project) 
	* 
	* Description:
	* 	- generates a modal pop up for a given project object 
	* 	- project objects look like this: 
	*		{
	*			"project_id": "1234",
	*			"project_name": "Cats",
	*			"elevator_pitch": "Cats are loving companions for now and all time.",
	*			"description": "Cats is about building a sustainable online community for earth humans.",
	*			"zoom_link": "http://example.com"
	*		}
	* 
	*/
	generateProjectModal(project) {
		// parse project descriptions to render without &amp; etc.
		// https://stackoverflow.com/questions/3700326/decode-amp-back-to-in-javascript

		if (!document.getElementById(project.project_id + "_modal")) {
			var parser = new DOMParser;

			let id = project.project_id;
			let name = project.project_name;
			let pitch = project.elevator_pitch;
			let description = project.description;
			let link = project.zoom_link;

			let modalEl = document.createElement('div');
			modalEl.className = "project-modal";
			modalEl.id = id + "_modal";

			let contentEl = document.createElement('div');
			contentEl.className = "project-modal-content";

			let closeButton = document.createElement('button');
			closeButton.addEventListener('click', () => {
				modalEl.remove();
			});
			closeButton.innerHTML = "X";

			let titleEl = document.createElement('h1');
			titleEl.innerHTML = parser.parseFromString('<!doctype html><body>' + name, 'text/html').body.textContent;

			let elevatorPitchEl = document.createElement('p');
			elevatorPitchEl.innerHTML = parser.parseFromString('<!doctype html><body>' + pitch, 'text/html').body.textContent;

			let descriptionEl = document.createElement('p');
			descriptionEl.innerHTML = parser.parseFromString('<!doctype html><body>' + description, 'text/html').body.textContent;

			let linkEl = document.createElement('p');
			linkEl.innerHTML = link;

			contentEl.appendChild(closeButton);
			contentEl.appendChild(titleEl);
			contentEl.appendChild(elevatorPitchEl);
			contentEl.appendChild(descriptionEl);
			contentEl.appendChild(linkEl);

			modalEl.appendChild(contentEl);
			document.body.appendChild(modalEl);
		}
	}

	/*
	* detectHyperlinks() 
	* 
	* Description:
	* 	- checks distance between player and object3Ds in this.hyperlinkedObjects array, 
	* 	- calls this.generateProjectModal for any projects under a threshold distance
	* 
	*/
	detectHyperlinks() {
		let thresholdDistanceSquared = 2;
		for (let i = 0; i < this.hyperlinkedObjects.length; i++) {
			let link = this.hyperlinkedObjects[i];
			let distSquared = this.playerGroup.position.distanceToSquared(link.position);
			if (distSquared < thresholdDistanceSquared) {
				this.generateProjectModal(link.userData.project);
			}
		}
	}

	loadFont() {
		var loader = new THREE.FontLoader();
		loader.load('fonts/helvetiker_bold.typeface.json', (response) => {
			console.log('font loader response');
			console.log(response);
			this.font = response;
		});
	}

	// from https://threejs.org/examples/?q=text#webgl_geometry_text
	createText(text, size, height, curveSegments, bevelThickness, bevelSize, bevelEnabled) {

		let textGeo = new THREE.TextGeometry(text, {

			font: this.font,

			size: size,
			height: height,
			curveSegments: curveSegments,

			bevelThickness: bevelThickness,
			bevelSize: bevelSize,
			bevelEnabled: bevelEnabled

		});

		textGeo.computeBoundingBox();
		textGeo.computeVertexNormals();

		var triangle = new THREE.Triangle();

		let materials = [
			new THREE.MeshPhongMaterial({ color: 0xffffee, flatShading: true }), // front
			new THREE.MeshPhongMaterial({ color: 0x000000 }) // side
		];

		// "fix" side normals by removing z-component of normals for side faces
		// (this doesn't work well for beveled geometry as then we lose nice curvature around z-axis)

		if (!bevelEnabled) {

			var triangleAreaHeuristics = 0.1 * (height * size);

			for (var i = 0; i < textGeo.faces.length; i++) {

				var face = textGeo.faces[i];

				if (face.materialIndex == 1) {

					for (var j = 0; j < face.vertexNormals.length; j++) {

						face.vertexNormals[j].z = 0;
						face.vertexNormals[j].normalize();

					}

					var va = textGeo.vertices[face.a];
					var vb = textGeo.vertices[face.b];
					var vc = textGeo.vertices[face.c];

					var s = triangle.set(va, vb, vc).getArea();

					if (s > triangleAreaHeuristics) {

						for (var j = 0; j < face.vertexNormals.length; j++) {

							face.vertexNormals[j].copy(face.normal);

						}

					}

				}

			}

		}

		var centerOffset = - 0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x);

		textGeo = new THREE.BufferGeometry().fromGeometry(textGeo);

		let textMesh = new THREE.Mesh(textGeo, materials);
		let hover = 5;

		textMesh.position.x = centerOffset;
		textMesh.position.y = hover;
		textMesh.position.z = 0;

		textMesh.rotation.x = 0;
		textMesh.rotation.y = Math.PI * 2;

		// let group = new THREE.Group();
		// group.add(textMesh);

		return textMesh;

		// if (mirror) {

		// 	textMesh2 = new THREE.Mesh(textGeo, materials);

		// 	textMesh2.position.x = centerOffset;
		// 	textMesh2.position.y = - hover;
		// 	textMesh2.position.z = height;

		// 	textMesh2.rotation.x = Math.PI;
		// 	textMesh2.rotation.y = Math.PI * 2;

		// 	group.add(textMesh2);

		// }

	}

	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	// Player Controls:

	// Set up pointer lock controls and corresponding event listeners
	setupControls() {
		let jumpSpeed = 75;
		this.controls = new THREE.PointerLockControls(this.camera, this.renderer.domElement);

		this.moveForward = false;
		this.moveBackward = false;
		this.moveLeft = false;
		this.moveRight = false;
		this.canJump = false;

		this.prevTime = performance.now();
		this.velocity = new THREE.Vector3();
		this.direction = new THREE.Vector3();
		this.vertex = new THREE.Vector3();
		this.color = new THREE.Color();

		var blocker = document.getElementById('blocker');
		var instructions = document.getElementById('instructions');

		blocker.addEventListener('click', () => {

			this.controls.lock();

		}, false);

		this.controls.addEventListener('lock', function () {

			instructions.style.display = 'none';
			blocker.style.display = 'none';

		});

		this.controls.addEventListener('unlock', function () {

			blocker.style.display = 'block';
			instructions.style.display = '';

		});

		document.addEventListener('keydown', (event) => {

			switch (event.keyCode) {

				case 38: // up
				case 87: // w
					this.moveForward = true;
					break;

				case 37: // left
				case 65: // a
					this.moveLeft = true;
					break;

				case 40: // down
				case 83: // s
					this.moveBackward = true;
					break;

				case 39: // right
				case 68: // d
					this.moveRight = true;
					break;

				case 32: // space
					if (this.canJump === true) this.velocity.y = jumpSpeed;
					this.canJump = false;
					break;

			}

		}, false);

		document.addEventListener('keyup', (event) => {

			switch (event.keyCode) {

				case 38: // up
				case 87: // w
					this.moveForward = false;
					break;

				case 37: // left
				case 65: // a
					this.moveLeft = false;
					break;

				case 40: // down
				case 83: // s
					this.moveBackward = false;
					break;

				case 39: // right
				case 68: // d
					this.moveRight = false;
					break;

			}

		}, false);


		// this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, - 1, 0), 0, 1);
		window.controls = this.controls; // for debugging

		this.velocity.y = jumpSpeed;
	}

	// update for these controls, which are unfortunately not included in the controls directly...
	// see: https://github.com/mrdoob/three.js/issues/5566
	updateControls() {
		let speed = 200;
		if (this.controls.isLocked === true) {
			var origin = this.controls.getObject().position.clone();
			origin.y -= this.cameraHeight; // origin is at floor level

			this.raycaster.set(origin, new THREE.Vector3(0, - 1, 0));

			var intersectionsDown = this.raycaster.intersectObjects(this.collidableMeshList);
			var onObject = (intersectionsDown.length > 0 && intersectionsDown[0].distance < 0.1);


			var time = performance.now();
			var delta = (time - this.prevTime) / 1000;

			this.velocity.x -= this.velocity.x * 10.0 * delta;
			this.velocity.z -= this.velocity.z * 10.0 * delta;

			this.velocity.y -= 9.8 * 50.0 * delta; // 100.0 = mass

			this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
			this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
			this.direction.normalize(); // this ensures consistent this.movements in all this.directions


			if (this.moveForward || this.moveBackward) {
				this.velocity.z -= this.direction.z * speed * delta;
			}

			if (this.moveLeft || this.moveRight) {
				this.velocity.x -= this.direction.x * speed * delta;
			}

			if (onObject === true) {
				console.log(this.controls.getObject().position.y);
				console.log(intersectionsDown);
				this.velocity.y = Math.max(0, this.velocity.y);
				this.canJump = true;
			} else {
				console.log('not on object');
			}


			if ((this.velocity.x > 0 && !this.obstacles.left) || (this.velocity.x < 0 && !this.obstacles.right)) {
				this.controls.moveRight(- this.velocity.x * delta);
			}
			if ((this.velocity.z > 0 && !this.obstacles.backward) || (this.velocity.z < 0 && !this.obstacles.forward)) {
				this.controls.moveForward(- this.velocity.z * delta);
			}

			this.controls.getObject().position.y += (this.velocity.y * delta); // new behavior


			if (this.controls.getObject().position.y < this.cameraHeight) {
				console.log('resetting camera height to ' + this.cameraHeight);
				this.velocity.y = 0;
				this.controls.getObject().position.y = this.cameraHeight;
				this.canJump = true;
			}



			this.prevTime = time;

		}
	}

	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	// Position Update for Socket

	getPlayerPosition() {
		// TODO: use quaternion or are euler angles fine here?
		return [
			[this.camera.position.x, this.camera.position.y - (this.cameraHeight-0.5), this.camera.position.z],
			[this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z]];
	}

	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	// Loop ⭕️

	update() {
		requestAnimationFrame(() => this.update());
		this.stats.update();

		// send movement stats to the socket server if any of the keys have been pressed
		// let sendStats = false;
		// for (let i in this.keyState) {
		// 	if (this.keyState[i]) {
		// 		sendStats = true;
		// 		break;
		// 	}
		// }

		// if (sendStats) { this.movementCallback(); }

		// update volumes every 10 frames
		this.frameCount++;
		if (this.frameCount % 20 == 0) {
			this.updateClientVolumes();
			this.movementCallback();
		}

		this.updatePositions();
		this.detectCollisions();
		this.updateControls();

		this.checkKeys();
		this.render();
	}



	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	// Rendering 🎥

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


	updateClientVolumes() {
		let distanceThresholdSquared = 2500; // over this distance, no sound is heard
		let numerator = 50; // TODO rename this

		for (let _id in this.clients) {
			if (this.clients[_id].audioElement) {
				let distSquared = this.camera.position.distanceToSquared(this.clients[_id].group.position);
				if (distSquared > distanceThresholdSquared) {
					// TODO pause consumer here, rather than setting volume to zero
					this.clients[_id].audioElement.volume = 0;
					pauseAllConsumersForPeer(_id);
				} else {
					resumeAllConsumersForPeer(_id);
					// from lucasio here: https://discourse.threejs.org/t/positionalaudio-setmediastreamsource-with-webrtc-question-not-hearing-any-sound/14301/29

					let volume = Math.min(1, numerator / distSquared);
					this.clients[_id].audioElement.volume = volume;
				}
			}
		}
	}

	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	// Event Handlers 🍽

	onWindowResize(e) {
		this.width = (window.innerWidth * 0.9);
		this.height = (window.innerHeight * 0.8);
		// this.width = window.innerWidth;
		// this.height = Math.floor(window.innerHeight - (window.innerHeight * 0.3));
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

	checkKeys() {
		if (this.keyState[32]) {
			this.detectHyperlinks();
		}
	}

	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
	//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
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

		// for the moment, positional audio using webAudio and THREE.PositionalAudio doesn't work...
		// see the issues on github
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