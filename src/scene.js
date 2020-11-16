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
import {YORBControls} from "./yorbControls";

const THREE = require("./libs/three.min.js");
const Stats = require("./libs/stats.min.js");
const EventEmitter = require("events");

const p5 = require("p5");
const p5sketches = require("./p5sketches");

// slightly awkward syntax, but these statements add these functions to THREE
require("./libs/GLTFLoader.js")(THREE);


class Scene extends EventEmitter {
  constructor(
		_movementCallback,
		_clients,
		mySocketID) {
			super();

		// add this to window to allow javascript console debugging
		window.scene = this;

		// this pauses or restarts rendering and updating
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

    // this.setupControls();
    this.controls = new YORBControls(this.scene, this.camera, this.renderer);
		this.addLights();
		// this.setupCollisionDetection();

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



    if (!this.controls.paused) {
      this.controls.update();

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
    } else {
      console.log('scene paused');
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
