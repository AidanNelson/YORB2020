/*
 * YORB 2020
 *
 * Aidan Nelson, April 2020
 *
 */

import {
  pauseAllConsumersForPeer,
  resumeAllConsumersForPeer,
  hackToRemovePlayerTemporarily,
} from "./index.js";

import { SpringShow } from "./springShow2020";
import {ITPModel } from "./ITPModel";
import {Sketches} from "./Sketches";

const THREE = require("./libs/three.min.js");
const Stats = require("./libs/stats.min.js");
const EventEmitter = require("events");

const p5 = require("p5");
const p5sketches = require("./p5sketches");

// slightly awkward syntax, but these statements add these functions to THREE
require("./libs/GLTFLoader.js")(THREE);
require("./libs/pointerLockControls.js")(THREE);

class Scene extends EventEmitter {
  constructor(
		_movementCallback,
		_clients,
		mySocketID) {
			super();

		// add this to window to allow javascript console debugging
		window.scene = this;

		// this pauses or restarts rendering and updating
		this.paused = true;
		let domElement = document.getElementById('scene-container');
		this.frameCount = 0;
		this.clients = _clients;
		this.mySocketID = mySocketID;
		this.hyperlinkedObjects = []; // array to store interactable hyperlinked meshes
		this.DEBUG_MODE = false;
		this.movementCallback = _movementCallback;
		this.width = (window.innerWidth * 0.9);
		this.height = (window.innerHeight * 0.7);
		this.scene = new THREE.Scene();
		this.gravity = 2.0;
		this.raycaster = new THREE.Raycaster();
		this.textParser = new DOMParser;
		this.mouse = {
			x: 0,
			y: 0
		};
		this.hightlightedProjectId = -1; // to start
		this.textureLoader = new THREE.TextureLoader();


		// audio variables:
		this.distanceThresholdSquared = 500;
		this.rolloffNumerator = 5;


        // collision detection setup:
        this.collidableMeshList = [];

		// STATS for debugging:
		this.stats = new Stats();
		document.body.appendChild(this.stats.dom);
		this.stats.dom.style = "visibility: hidden;";


		//THREE Camera
		this.cameraHeight = 1.75;
		this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 5000);

		/*
		*
		* STARTING POSITIONS
		*
		*/

		// Elevator bank range: x: 3 to 28, z: -2.5 to 1.5

		// In front of Red Square / ER range: x: -7.4 to - 13.05, z: -16.8 to -8.3
		let randX = this.randomRange(-7.4, -13.05);
		let randZ = this.randomRange(-16.8, -8.3);
		this.camera.position.set(randX, this.cameraHeight, randZ);

		// Coding Lab

		// let codingLab = { x: -12.7,
		// 									y: 0.5,
		// 									z: 10.57
		// 								}
		// this.camera.position.set(codingLab.x, this.cameraHeight, codingLab.z);

		// Classrooms

		// let classRoom1 = {	x:9.495,
		// 										y:0.5,
		// 										z:28.685
		// 									}
		// let classRoom2 = {	x:17.5,
		// 										y:0.5,
		// 										z:28.685
		// 									}
		// let classRoom3 = {	x:25.5,
		// 										y:0.5,
		// 										z:28.685
		// 									}
		// let classRoom4 = {	x:33.0000,
		// 										y:0.5,
		// 										z:28.685
		// 									}

		// create an AudioListener and add it to the camera
		this.listener = new THREE.AudioListener();
		this.camera.add(this.listener);
		this.scene.add(this.camera);

		// For Empire State Maker Faire: make the camera looking at the middle point betwen the two columns in Red Square

		// this.camera.lookAt(new THREE.Vector3(0, this.cameraHeight, 0));
		this.camera.lookAt(new THREE.Vector3(-13.6, this.cameraHeight, -14.5));

		window.camera = this.camera;

		//THREE WebGL renderer
		this.renderer = new THREE.WebGLRenderer({
			antialiasing: true
		});
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.setClearColor(new THREE.Color('lightblue'));
		this.renderer.setSize(this.width, this.height);

		this.setupControls();
		this.addLights();
		this.setupCollisionDetection();

		this.loadBackground();


		this.projectionScreens = {}; // object to store projector screens
		this.createProjectorScreens();
		// Blank projector screen

        this.itpModel = new ITPModel(this.scene);

        this.show = new SpringShow(this.scene, this.camera, this.controls);
		this.show.setup();

    this.sketches = new Sketches(this.scene);
    setTimeout(() => {
      this.sketches.addSketches();
    }, 5000); // try to let the sketches finish loading

		//Push the canvas to the DOM
		domElement.append(this.renderer.domElement);

		//Setup event listeners for events and handle the states
		window.addEventListener('resize', e => this.onWindowResize(e), false);
		domElement.addEventListener('click', e => this.onMouseClick(e), false);
		window.addEventListener('keydown', e => this.onKeyDown(e), false);
		window.addEventListener('keyup', e => this.onKeyUp(e), false);

		this.shift_down = false;
		// Helpers
		this.helperGrid = new THREE.GridHelper(500, 500);
		this.helperGrid.position.y = -0.1; // offset the grid down to avoid z fighting with floor
		this.scene.add(this.helperGrid);

		this.update();
		this.render();
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
    dirLight.position.set(-1, 0.5, -1);
    dirLight.position.multiplyScalar(200);
    this.scene.add(dirLight);

    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;

    var d = 150;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;

    dirLight.shadow.camera.far = 3500;
    dirLight.shadow.bias = -0.0001;

    // secondary directional light without shadows:
    let dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight2.color.setHSL(0.1, 1, 0.95);
    dirLight2.position.set(1, 0.5, -1);
    dirLight2.position.multiplyScalar(200);
    this.scene.add(dirLight2);
  }

  //
  // update projects:
  updateProjects(projects){
      this.show.updateProjects(projects);
  }

  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // Model 🏗

  loadBackground() {
    var path = "models/Park2/";
    var format = ".jpg";
    this.envMap = new THREE.CubeTextureLoader().load([
      path + "posx" + format,
      path + "negx" + format,
      path + "posy" + format,
      path + "negy" + format,
      path + "posz" + format,
      path + "negz" + format,
    ]);
    this.scene.background = this.envMap;
  }


  createProjectorScreens() {

		let locations = {
			data: [
				// {	room: "entranceWay",
				// 	x: 3.3663431855797707,
				// 	y: 1.9,
				// 	z: -0.88,
				// 	rot: Math.PI/2
				// },
				// { room: "classRoom1-center",
				// 	x: 2.8,
				// 	y: 1.9,
				// 	z: 24.586520,
				// 	rot: Math.PI/2
				// },
				{ room: "classRoom1-left",
					x: 2.8,
					y: 1.9,
					z: 27.309458609,
					rot: Math.PI/2
				},
				{ room: "classRoom1-right",
					x: 2.8,
					y: 1.9,
					z: 22.123456,
					rot: Math.PI/2
				},
				{ room: "classRoom2-left",
					x: 10.4,
					y: 1.9,
					z: 27.309458609,
					rot: Math.PI/2
				},
				{ room: "classRoom2-right",
					x: 10.4,
					y: 1.9,
					z: 22.123456,
					rot: Math.PI/2
				},
				{ room: "classRoom3-left",
					x: 18.0000,
					y: 1.9,
					z: 27.309458609,
					rot: Math.PI/2
				},
				{ room: "classRoom3-right",
					x: 18.000000,
					y: 1.9,
					z: 22.123456,
					rot: Math.PI/2
				},
				{ room: "classRoom4-left",
					x: 25.7000,
					y: 1.9,
					z: 27.309458609,
					rot: Math.PI/2
				},
				{ room: "classRoom4-right",
					x: 25.700000,
					y: 1.9,
					z: 22.123456,
					rot: Math.PI/2
				},
				{	room: "redSquare",
					x: -23.5,
					y: 1.9,
					z: -14.675,
					rot: Math.PI/2
				}
			]
		};

		let num = locations.data.length;

		for(let i = 0; i < num; i++) {

			let blankScreenVideo = document.createElement('video');
			blankScreenVideo.setAttribute('id', 'default_screenshare');
			document.body.appendChild(blankScreenVideo);
			blankScreenVideo.src = "/images/old-television.mp4";
			blankScreenVideo.loop = true;
			blankScreenVideo.play();

			let _id = "screenshare" + i;
			let dims = { width: 1920, height: 1080 }
			let [videoTexture, videoMaterial] = this.makeVideoTextureAndMaterial(_id, dims);

			let screen = new THREE.Mesh(
				new THREE.BoxGeometry(5, 5*9/16, 0.01),
				videoMaterial
			);

			screen.position.set(locations.data[i].x, locations.data[i].y, locations.data[i].z);
			screen.rotateY(locations.data[i].rot);
			this.scene.add(screen);

			screen.userData = {
				videoTexture: videoTexture,
				activeUserId: "default",
				screenId: _id
			}

			this.projectionScreens[_id] = screen;
		}

	}

  projectToScreen(screenId) {
    console.log("I'm going to project to screen " + screenId);
    this.emit("projectToScreen", screenId);
    this.projectionScreens[screenId].userData.activeUserId = this.mySocketID;
  }

  updateProjectionScreen(config) {
    let screenId = config.screenId;
    let activeUserId = config.activeUserId;
    this.projectionScreens[screenId].userData.activeUserId = activeUserId;
    console.log(
      "Updating Projection Screen: " +
        screenId +
        " with screenshare from user " +
        activeUserId
    );
  }

  /*
   * updateProjectionScreens()
   * This function will loop through all of the projection screens,
   * and update them if there is an active user and that user
   * is screensharing currently
   *
   */
  updateProjectionScreens() {
    for (let screenId in this.projectionScreens) {
      let screen = this.projectionScreens[screenId];
      let activeUserId = screen.userData.activeUserId;
      let videoTexture = screen.userData.videoTexture;

      let canvasEl = document.getElementById(`${screenId}_canvas`);
      let videoEl = document.getElementById(`${activeUserId}_screenshare`);

      if (videoEl != null && canvasEl != null) {
        this.redrawVideoCanvas(videoEl, canvasEl, videoTexture);
      }
    }
  }

  checkProjectorCollisions() {
    var matrix = new THREE.Matrix4();
    matrix.extractRotation(this.camera.matrix);
    var backwardDir = new THREE.Vector3(0, 0, 1).applyMatrix4(matrix);
    var forwardDir = backwardDir.clone().negate();

    // TODO more points around avatar so we can't be inside of walls
    let pt = this.controls.getObject().position.clone();

    let raycaster = new THREE.Raycaster();

    raycaster.set(pt, forwardDir);

    var intersects = raycaster.intersectObjects(
      Object.values(this.projectionScreens)
    );

    // if we have intersections, highlight them
    let thresholdDist = 7;
    if (intersects.length > 0) {
      if (intersects[0].distance < thresholdDist) {
        // this.screenHoverImage.style = "visiblity: visible;"
        let screen = intersects[0].object;
        this.hightlightedScreen = screen;
        // console.log(screen.material)
      } else {
        this.hightlightedScreen = null;
      }
    }
  }
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // Clients 👫

  addSelf() {
    let _body = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshNormalMaterial()
    );

    let [videoTexture, videoMaterial] = this.makeVideoTextureAndMaterial(
      "local"
    );

    let _head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), videoMaterial);

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
      new THREE.BoxGeometry(0.5, 1, 0.5),
      new THREE.MeshNormalMaterial()
    );

    let [videoTexture, videoMaterial] = this.makeVideoTextureAndMaterial(_id);

    let _head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), videoMaterial);

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
          this.clients[_id].desiredPosition = new THREE.Vector3(
            _clientProps[_id].position[0],
            _clientProps[_id].position[1],
            _clientProps[_id].position[2]
          );
          // this.clients[_id].desiredRotation = new THREE.Quaternion().fromArray(_clientProps[_id].rotation)
          let euler = new THREE.Euler(
            0,
            _clientProps[_id].rotation[1],
            0,
            "XYZ"
          );
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
        this.clients[_id].group.position.lerp(
          this.clients[_id].desiredPosition,
          0.2
        );
        if (
          this.clients[_id].group.position.distanceTo(
            this.clients[_id].desiredPosition
          ) < snapDistance
        ) {
          this.clients[_id].group.position.set(
            this.clients[_id].desiredPosition.x,
            this.clients[_id].desiredPosition.y,
            this.clients[_id].desiredPosition.z
          );
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


    this.obstacles = {
      forward: false,
      backward: false,
      right: false,
      left: false,
    };

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
        var arrow = new THREE.ArrowHelper(
          new THREE.Vector3(),
          new THREE.Vector3(),
          1,
          0x000000
        );
        this.collisionDetectionDebugArrows.push(arrow);
        this.scene.add(arrow);
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
      var pt = vecA
        .clone()
        .add(dirVec.clone().multiplyScalar(i / (numPoints - 1)));
      points.push(pt);
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
      left: false,
    };

    // TODO only use XZ components of forward DIR in case we are looking up or down while travelling forward
    // NOTE: THREE.PlayerControls seems to be backwards (i.e. the 'forward' controls go backwards)...
    // Weird, but this function respects those directions for the sake of not having to make conversions
    // https://github.com/mrdoob/three.js/issues/1606
    var matrix = new THREE.Matrix4();
    matrix.extractRotation(this.camera.matrix);
    var backwardDir = new THREE.Vector3(0, 0, 1).applyMatrix4(matrix);
    var forwardDir = backwardDir.clone().negate();
    var rightDir = forwardDir
      .clone()
      .cross(new THREE.Vector3(0, 1, 0))
      .normalize();
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
    this.obstacles.forward = this.checkCollisions(
      this.forwardCollisionDetectionPoints,
      forwardDir,
      0
    );
    this.obstacles.backward = this.checkCollisions(
      this.backwardCollisionDetectionPoints,
      backwardDir,
      4
    );
    this.obstacles.left = this.checkCollisions(
      this.leftCollisionDetectionPoints,
      leftDir,
      8
    );
    this.obstacles.right = this.checkCollisions(
      this.rightCollisionDetectionPoints,
      rightDir,
      12
    );

    // this.controls.obstacles = this.obstacles;
  }

  checkCollisions(pts, dir, arrowHelperOffset) {
    // distance at which a collision will be detected and movement stopped (this should be greater than the movement speed per frame...)
    var detectCollisionDistance = 1;

    let collidables = this.itpModel.getCollidableMeshList();

    for (var i = 0; i < pts.length; i++) {
      var pt = pts[i].clone();
      // pt.applyMatrix4(this.playerGroup.matrix);
      // pt.y += 1.0; // bias upward to head area of player

      this.raycaster.set(pt, dir);
      var collisions = this.raycaster.intersectObjects(collidables);

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

      if (
        collisions.length > 0 &&
        collisions[0].distance < detectCollisionDistance
      ) {
        return true;
      }
    }
    return false;
  }



  createSignage() {
    let textDepth = 0.1;
    let curveSegments = 3;
    let message, txt;

    message = "Welcome to";
    // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror
    txt = this.create3DText(
      message,
      0.25,
      textDepth,
      curveSegments,
      0.01,
      0.01,
      false,
      false
    );
    txt.position.set(-2, 2.85, 0.0);
    txt.rotateY(Math.PI / 2);
    this.scene.add(txt);

    message = "ITP  ";
    // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror
    txt = this.create3DText(
      message,
      1.15,
      textDepth,
      curveSegments,
      0.01,
      0.01,
      false,
      false
    );
    txt.position.set(-2.25, 1.5, 0.0);
    txt.rotateY(Math.PI / 2);
    this.scene.add(txt);

    message = "Interactive Telecommunications Program";
    // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror
    txt = this.create3DText(
      message,
      0.25,
      textDepth,
      curveSegments,
      0.01,
      0.01,
      false,
      false
    );
    txt.position.set(-2, 1.15, 0.0);
    txt.rotateY(Math.PI / 2);
    this.scene.add(txt);

    message = "The E.R.";
    txt = this.create3DText(
      message,
      0.6,
      textDepth,
      curveSegments,
      0.01,
      0.01,
      false,
      false
    );
    txt.position.set(-11.25, 1.75, -18.5);
    txt.rotateY(0);
    this.scene.add(txt);

    message = "Resident's Residence";
    txt = this.create3DText(
      message,
      0.6,
      textDepth,
      curveSegments,
      0.01,
      0.01,
      false,
      false
    );
    txt.position.set(-12.5, 1.75, -0.75);
    txt.rotateY(-Math.PI / 2);
    this.scene.add(txt);
  }

  

 

  

  

  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // Player Controls:

  // Set up pointer lock controls and corresponding event listeners
  setupControls() {
    let jumpSpeed = 12;
    this.controls = new THREE.PointerLockControls(
      this.camera,
      this.renderer.domElement
    );

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

    var overlay = document.getElementById("overlay");

    this.controls.addEventListener("lock", () => {
      this.clearControls();
      this.paused = false;
      overlay.style.visibility = "hidden";
      document.getElementById("instructions-overlay").style.visibility =
        "visible";
    });

    this.controls.addEventListener("unlock", () => {
      overlay.style.visibility = "visible";
      this.clearControls();
      this.paused = true;
      document.getElementById("instructions-overlay").style.visibility =
        "hidden";
    });

    document.addEventListener(
      "keydown",
      (event) => {
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
      },
      false
    );

    document.addEventListener(
      "keyup",
      (event) => {
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
      },
      false
    );

    this.velocity.y = 0;
  }

  // clear control state every time we reenter the game
  clearControls() {
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;
    this.velocity.x = 0;
    this.velocity.z = 0;
    this.velocity.y = 0;
  }

  // update for these controls, which are unfortunately not included in the controls directly...
  // see: https://github.com/mrdoob/three.js/issues/5566
  updateControls() {
		let speed = 50;
		if (this.controls.isLocked === true) {
			var origin = this.controls.getObject().position.clone();
			origin.y -= this.cameraHeight; // origin is at floor level

			this.raycaster.set(origin, new THREE.Vector3(0, - this.cameraHeight, 0));

			var intersectionsDown = this.raycaster.intersectObjects(this.collidableMeshList);
			var onObject = (intersectionsDown.length > 0 && intersectionsDown[0].distance < 0.1);


			var time = performance.now();
			var rawDelta = (time - this.prevTime) / 1000;
			// clamp delta so lower frame rate clients don't end up way far away
			let delta = Math.min(rawDelta, 0.1);

			this.velocity.x -= this.velocity.x * 10.0 * delta;
			this.velocity.z -= this.velocity.z * 10.0 * delta;

			// Here we talkin bout gravity...
			// this.velocity.y -= 9.8 * 8.0 * delta; // 100.0 = mass

			// For double-jumping!
			if (this.camera.position.y > 2.5) {
				// less gravity like when we begin
				this.gravity = 2.0;
			} else {
				// once we get below the ceiling, the original value
				this.gravity = 8.0;
			}
			this.velocity.y -= 9.8 * this.gravity * delta; // 100.0 = mass

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
				this.velocity.y = Math.max(0, this.velocity.y);
				this.canJump = true;
			}


			if ((this.velocity.x > 0 && !this.obstacles.left) || (this.velocity.x < 0 && !this.obstacles.right)) {
				this.controls.moveRight(- this.velocity.x * delta);
			}
			if ((this.velocity.z > 0 && !this.obstacles.backward) || (this.velocity.z < 0 && !this.obstacles.forward)) {
				this.controls.moveForward(- this.velocity.z * delta);
			}

			this.controls.getObject().position.y += (this.velocity.y * delta); // new behavior


			if (this.controls.getObject().position.y < this.cameraHeight) {
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
      [
        this.camera.position.x,
        this.camera.position.y - (this.cameraHeight - 0.5),
        this.camera.position.z,
      ],
      [this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z],
    ];
  }

  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // Loop ⭕️

  update() {
    requestAnimationFrame(() => this.update());



    if (!this.paused) {
      this.updateControls();

      this.frameCount++;

      // things to update 5 x per second
      if (this.frameCount % 10 === 0){
        this.sketches.update();
      }

      if (this.frameCount % 20 == 0) {
        this.updateClientVolumes();
        this.movementCallback();
        this.show.update();
        this.checkProjectorCollisions();
      }
      if (this.frameCount % 50 == 0) {
        this.selectivelyPauseAndResumeConsumers();
      }
      this.detectCollisions();
    }

    this.stats.update();
    this.updatePositions(); // other users
    this.render();
  }
  // hey billy!
  // can you read this??
  // i'm writing javascript!
  // function myfunc() = cool stuff;

  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // Rendering 🎥

  render() {
    // Update video canvases for each client
    this.updateVideoTextures();
    // update all projection screens:
    this.updateProjectionScreens();
    this.renderer.render(this.scene, this.camera);
  }

  updateVideoTextures() {
    // update for the clients
    for (let _id in this.clients) {
      let remoteVideo = document.getElementById(_id + "_video");
      let remoteVideoCanvas = document.getElementById(_id + "_canvas");
      if (remoteVideo != null && remoteVideoCanvas != null) {
        this.redrawVideoCanvas(
          remoteVideo,
          remoteVideoCanvas,
          this.clients[_id].texture
        );
      }
    }
  }

  // this function redraws on a 2D <canvas> from a <video> and indicates to three.js
  // that the _videoTex should be updated
  redrawVideoCanvas(_videoEl, _canvasEl, _videoTex) {
    let _canvasDrawingContext = _canvasEl.getContext("2d");

    // check that we have enough data on the video element to redraw the canvas
    if (_videoEl.readyState === _videoEl.HAVE_ENOUGH_DATA) {
      // if so, redraw the canvas from the video element
      _canvasDrawingContext.drawImage(
        _videoEl,
        0,
        0,
        _canvasEl.width,
        _canvasEl.height
      );
      // and indicate to three.js that the texture needs to be redrawn from the canvas
      _videoTex.needsUpdate = true;
    }
  }

  // Adapted from: https://github.com/zacharystenger/three-js-video-chat
  makeVideoTextureAndMaterial(_id, dims = null) {
    // create a canvas and add it to the body
    let rvideoImageCanvas = document.createElement("canvas");
    document.body.appendChild(rvideoImageCanvas);

    rvideoImageCanvas.id = _id + "_canvas";

    // Dims for projector screens.
    if (dims) {
      rvideoImageCanvas.width = dims.width;
      rvideoImageCanvas.height = dims.height;
    }

    rvideoImageCanvas.style = "visibility: hidden;";

    // get canvas drawing context
    let rvideoImageContext = rvideoImageCanvas.getContext("2d");

    // background color if no video present
    rvideoImageContext.fillStyle = "#000000";
    rvideoImageContext.fillRect(
      0,
      0,
      rvideoImageCanvas.width,
      rvideoImageCanvas.height
    );

    // make texture
    let videoTexture = new THREE.Texture(rvideoImageCanvas);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;

    // make material from texture
    var movieMaterial = new THREE.MeshBasicMaterial({
      map: videoTexture,
      overdraw: true,
      side: THREE.DoubleSide,
    });

    return [videoTexture, movieMaterial];
  }

  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // Audio 📣

  updateClientVolumes() {
    for (let _id in this.clients) {
      if (this.clients[_id].audioElement) {
        let distSquared = this.camera.position.distanceToSquared(
          this.clients[_id].group.position
        );
        if (distSquared > this.distanceThresholdSquared) {
          // TODO pause consumer here, rather than setting volume to zero
          this.clients[_id].audioElement.volume = 0;
        } else {
          // from lucasio here: https://discourse.threejs.org/t/positionalaudio-setmediastreamsource-with-webrtc-question-not-hearing-any-sound/14301/29
          let volume = Math.min(1, this.rolloffNumerator / distSquared);
          this.clients[_id].audioElement.volume = volume;
        }
      }
    }
  }

  getClosestPeers() {
    let peerIDs = [];
    for (let _id in this.clients) {
      let distSquared = this.camera.position.distanceToSquared(
        this.clients[_id].group.position
      );
      if (distSquared <= this.distanceThresholdSquared) {
        peerIDs.push(_id);
      }
    }
    return peerIDs;
  }

  selectivelyPauseAndResumeConsumers() {
    for (let _id in this.clients) {
      let distSquared = this.camera.position.distanceToSquared(
        this.clients[_id].group.position
      );
      if (distSquared > this.distanceThresholdSquared) {
        pauseAllConsumersForPeer(_id);
      } else {
        resumeAllConsumersForPeer(_id);
      }
    }
  }

  // At the moment, this just adds a .audioElement parameter to a client stored under _id
  // which will be updated above
  createOrUpdatePositionalAudio(_id) {
    let audioElement = document.getElementById(_id + "_audio");
    if (audioElement == null) {
      console.log("No audio element found for user with ID: " + _id);
      return;
    }
    this.clients[_id].audioElement = audioElement;
    console.log(
      "The following audio element attached to client with ID " + _id + ":"
    );
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

  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // Event Handlers 🍽

  onWindowResize(e) {
    this.width = window.innerWidth * 0.9;
    this.height = window.innerHeight * 0.7;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  onMouseClick(e) {
    // not used currently
    // this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    // this.mouse.y = - (e.clientY / window.innerHeight) * 2 + 1;
    // console.log("Click");
    this.show.activateHighlightedProject();
    //typo on line 2045****
    if (this.hightlightedScreen && this.shift_down) {
      this.projectToScreen(this.hightlightedScreen.userData.screenId);
    }
  }

  onKeyDown(e) {
    if (e.keyCode == 16) {
      this.shift_down = true;
    }
  }

  onKeyUp(e) {
    if (e.keyCode == 16) {
      this.shift_down = false;
    }
  }

  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // Utilities:

  /**
   * Returns a random number between min (inclusive) and max (exclusive)
   * https://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range#1527820
   */
  randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  //==//==//==//==//==//==//==//==// fin //==//==//==//==//==//==//==//==//==//
}

export default Scene;
