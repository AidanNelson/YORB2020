/* 
* YORB 2020
* 
* Adapted from a THREE.js Multiplayer boilerplate made by Or Fleisher:
* https://github.com/juniorxsound/THREE.Multiplayer
* with terrain from https://github.com/mrdoob/three.js/blob/master/examples/webgl_geometry_terrain.html
*
*/
let clients = new Object();

class Scene {
	constructor(
		domElement = document.getElementById('gl_context'),
		_width = window.innerWidth,
		_height = 400,
		hasControls = true,
		clearColor = 'lightblue',
		_movementCallback) {

		this.movementCallback = _movementCallback;

		//THREE scene
		this.scene = new THREE.Scene();

		//Utility
		this.width = _width;
		this.height = _height;

		// Player mesh (for 3rd Person view):
		this.player = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			new THREE.MeshNormalMaterial()
		);
		this.player.position.set(0, 0, 0);
		// let [videoTexture, videoMaterial] = makeVideoTextureAndMaterial("local-video");
		this.playerHead = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			new THREE.MeshNormalMaterial()
		);
		this.playerHead.position.set(0, 1, 0);
		this.player.add(this.playerHead);
		this.scene.add(this.player);



		//THREE Camera
		this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 5000);
		this.camera.position.set(0, 3, 5);
		this.camera.lookAt(this.player.position);
		this.scene.add(this.camera);

		// create an AudioListener and add it to the camera
		this.listener = new THREE.AudioListener();
		this.camera.add(this.listener);

		// create group to house player and camera
		// this.playerCamGroup = new THREE.Group();
		// this.playerCamGroup.add(this.player);
		// this.playerCamGroup.add(this.camera);

		// add this group to the scene
		this.scene.add(this.playerCamGroup);

		//THREE WebGL renderer
		this.renderer = new THREE.WebGLRenderer({
			antialiasing: true
		});

		this.renderer.setClearColor(new THREE.Color(clearColor));

		// add controls:
		// https://github.com/PiusNyakoojo/PlayerControls
		this.controls = new THREE.PlayerControls(this.camera, this.player);

		this.renderer.setSize(this.width, this.height);

		// add terrain
		var worldWidth = 512, worldDepth = 512;
		var data = generateHeight(worldWidth, worldDepth);
		let texture = new THREE.CanvasTexture(generateTexture(data, worldWidth, worldDepth));
		texture.wrapS = THREE.ClampToEdgeWrapping;
		texture.wrapT = THREE.ClampToEdgeWrapping;
		var geometry = new THREE.PlaneBufferGeometry(5000, 5000, worldWidth - 1, worldDepth - 1);
		geometry.rotateX(- Math.PI / 2);
		var vertices = geometry.attributes.position.array;
		for (var i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {
			vertices[j + 1] = data[i] * 0.5;
		}
		let mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
		mesh.position.y = -50;
		this.scene.add(mesh);

	

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
		// this.controls.update(this.clock.getDelta());
		// this.controls.target = new THREE.Vector3(0, 0, 0);
		this.controls.update();
		this.render();
	}

	updateVideoTextures() {
		for (let _id in clients) {
			if (_id != id) {
				if (clients[_id].videoCanvasCreated) {
					// console.log('updating video texture');
					// video DOM element
					let remoteVideo = document.getElementById(_id);
					// video canvas DOM element
					let remoteVideoCanvas = document.getElementById(_id + "_canvas");
					// video canvas DOM element drawing context
					let remoteVideoImageContext = remoteVideoCanvas.getContext('2d');


					if (remoteVideo) {
						if (remoteVideo.readyState === remoteVideo.HAVE_ENOUGH_DATA) {
							remoteVideoImageContext.drawImage(remoteVideo, 0, 0, remoteVideoCanvas.width, remoteVideoCanvas.height);
							if (clients[_id].texture) {
								clients[_id].texture.needsUpdate = true;
							}
						}
					} else {
						console.log('No remote video element found!');
					}
				}
			}
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
	onKeyDown(e) {
		this.movementCallback();
	}

	getPlayerPosition() {
		// notice the y height hack...
		return [this.player.position.x, 0.5, this.player.position.z];
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

function generateHeight(width, height) {

	var size = width * height, data = new Uint8Array(size),
		perlin = new ImprovedNoise(), quality = 1, z = Math.random() * 100;

	for (var j = 0; j < 4; j++) {

		for (var i = 0; i < size; i++) {

			var x = i % width, y = ~ ~(i / width);
			data[i] += Math.abs(perlin.noise(x / quality, y / quality, z) * quality * 1.75);

		}

		quality *= 5;

	}

	return data;

}


function makePlayerHead() {
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

	// store copy of texture for later updating
	// clients[_id].tex = rvideoTexture;
	// clients[_id].videoCanvasCreated = true;

	// make material from texture
	var movieMaterial = new THREE.MeshBasicMaterial({ map: videoTexture, overdraw: true, side: THREE.DoubleSide });

	return [videoTexture, movieMaterial];

}



