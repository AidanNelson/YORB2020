/*
 * YORB 2020
 *
 * Aidan Nelson, April 2020
 *
 */



import { SpringShow } from "./springShow2020";
import {ITPModel } from "./ITPModel";
import {Sketches} from "./Sketches";
import {YORBControls} from "./yorbControls";
import {ProjectionScreens} from "./projectionScreens";
import {Clients} from "./clients";

const THREE = require("./libs/three.min.js");
const Stats = require("./libs/stats.min.js");
const EventEmitter = require("events");

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

		// create an AudioListener and add it to the camera
		this.listener = new THREE.AudioListener();
		this.camera.add(this.listener);
		this.scene.add(this.camera);

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

		this.addLights();
		this.loadBackground();

    this.addYORBParts();

		//Push the canvas to the DOM
		domElement.append(this.renderer.domElement);

		//Setup event listeners for events and handle the states
		window.addEventListener('resize', e => this.onWindowResize(e), false);

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
        // this.updateClientVolumes();
        this.movementCallback();
        this.show.update();
        this.projectionScreens.checkProjectionScreenCollisions();
      }
      if (this.frameCount % 50 == 0) {
        // this.selectivelyPauseAndResumeConsumers();
      }
    }

    this.stats.update();
    // this.updatePositions(); // other users
    this.render();
  }

  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  //==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//==//
  // Rendering 🎥

  render() {
    // Update video canvases for each client
    // this.updateVideoTextures();
    this.renderer.render(this.scene, this.camera);
  }

  updateProjectionScreen(config){
    this.projectionScreens.updateProjectionScreen(config);
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
