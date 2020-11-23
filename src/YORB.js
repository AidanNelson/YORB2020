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

import {
  redrawVideoCanvas, makeVideoTextureAndMaterial
} from "./utils";

import { SpringShow } from "./springShow2020";
import {ITPModel } from "./ITPModel";
import {Sketches} from "./Sketches";
import {YORBControls} from "./yorbControls";
import {ProjectionScreens} from "./projectionScreens";

const THREE = require("./libs/three.min.js");
const Stats = require("./libs/stats.min.js");
const EventEmitter = require("events");

const p5 = require("p5");
const p5sketches = require("./p5sketches");

// slightly awkward syntax, but these statements add these functions to THREE
require("./libs/GLTFLoader.js")(THREE);


class YORB extends EventEmitter {
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
    
		this.addLights();
		// this.setupCollisionDetection();

		this.loadBackground();


    this.addYORBParts();
        

    

		//Push the canvas to the DOM
		domElement.append(this.renderer.domElement);

		//Setup event listeners for events and handle the states
		window.addEventListener('resize', e => this.onWindowResize(e), false);
		domElement.addEventListener('click', e => this.onMouseClick(e), false);

		
		// Helpers
		this.helperGrid = new THREE.GridHelper(500, 500);
		this.helperGrid.position.y = -0.1; // offset the grid down to avoid z fighting with floor
		this.scene.add(this.helperGrid);

		this.update();
		this.render();
	}

  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // add YORB parts  
  addYORBParts(){
    this.controls = new YORBControls(this.scene, this.camera, this.renderer);

    this.projectionScreens = new ProjectionScreens(this.scene, this.camera);
    this.itpModel = new ITPModel(this.scene);

    this.show = new SpringShow(this.scene, this.camera, this.controls);
    this.show.setup();
    
    this.sketches = new Sketches(this.scene);
    setTimeout(() => {
      this.sketches.addSketches();
    }, 5000); // try to let the sketches finish loading
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


 
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // Clients 👫

  addSelf() {
    let _body = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshNormalMaterial()
    );

    let [videoTexture, videoMaterial] = makeVideoTextureAndMaterial(
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

    let [videoTexture, videoMaterial] = makeVideoTextureAndMaterial(_id);

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
      this.frameCount++;

      // things to update 50 times per seconds:
      this.controls.update();
      this.projectionScreens.update();

      // things to update 5 x per second
      if (this.frameCount % 10 === 0){
        this.sketches.update();
      }

      if (this.frameCount % 20 == 0) {
        this.updateClientVolumes();
        this.movementCallback();
        this.show.update();
        this.projectionScreens.checkProjectionScreenCollisions();
      }
      if (this.frameCount % 50 == 0) {
        this.selectivelyPauseAndResumeConsumers();
      }
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
    // this.updateProjectionScreens();
    this.renderer.render(this.scene, this.camera);
  }

  updateVideoTextures() {
    // update for the clients
    for (let _id in this.clients) {
      let remoteVideo = document.getElementById(_id + "_video");
      let remoteVideoCanvas = document.getElementById(_id + "_canvas");
      if (remoteVideo != null && remoteVideoCanvas != null) {
        redrawVideoCanvas(
          remoteVideo,
          remoteVideoCanvas,
          this.clients[_id].texture
        );
      }
    }
  }

  updateProjectionScreen(config){
    this.projectionScreens.updateProjectionScreen(config);
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

export default YORB;
