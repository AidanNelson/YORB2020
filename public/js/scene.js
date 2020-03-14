/* 
* YORB 2020
* 
* Adapted from a THREE.js Multiplayer boilerplate made by Or Fleisher:
* https://github.com/juniorxsound/THREE.Multiplayer
* with terrain from https://github.com/mrdoob/three.js/blob/master/examples/webgl_geometry_terrain.html
*
*/

class Scene {
	constructor(domElement = document.getElementById('gl_context'),
		_width = window.innerWidth,
		_height = 400,
		hasControls = true,
		clearColor = 'lightblue',
		socket) {

		//Since we extend EventEmitter we need to instance it from here
		//   super();

		//THREE scene
		this.scene = new THREE.Scene();

		//Utility
		this.width = _width;
		this.height = _height;

		//THREE Camera
		this.camera = new THREE.PerspectiveCamera(80, this.width / this.height, 0.1, 5000);

		//THREE WebGL renderer
		this.renderer = new THREE.WebGLRenderer({
			antialiasing: true
		});

		this.renderer.setClearColor(new THREE.Color(clearColor));

		this.renderer.setSize(this.width, this.height);

		// add terrain
		var worldWidth = 128, worldDepth = 128;

		var data = generateHeight(worldWidth, worldDepth);


		let texture = new THREE.CanvasTexture(generateTexture(data, worldWidth, worldDepth));
		texture.wrapS = THREE.ClampToEdgeWrapping;
		texture.wrapT = THREE.ClampToEdgeWrapping;

		var geometry = new THREE.PlaneBufferGeometry(500, 500, worldWidth - 1, worldDepth - 1);
		geometry.rotateX(- Math.PI / 2);


		var vertices = geometry.attributes.position.array;

		for (var i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {

			vertices[j + 1] = data[i] * 0.5;

		}


		let mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
		mesh.position.y = -10;
		this.scene.add(mesh);


		//Push the canvas to the DOM
		domElement.append(this.renderer.domElement);

		if (hasControls) {
			this.controls = new THREE.FirstPersonControls(this.camera, this.renderer.domElement);
			this.controls.lookSpeed = 0.05;
		}

		//Setup event listeners for events and handle the states
		window.addEventListener('resize', e => this.onWindowResize(e), false);
		domElement.addEventListener('mouseenter', e => this.onEnterCanvas(e), false);
		domElement.addEventListener('mouseleave', e => this.onLeaveCanvas(e), false);
		window.addEventListener('keydown', e => this.onKeyDown(e), false);

		this.helperGrid = new THREE.GridHelper(20, 10);
		this.helperGrid.position.y = -0.5;
		this.scene.add(this.helperGrid);
		this.clock = new THREE.Clock();

		this.update();

	}

	drawUsers(positions, id) {
		for (let i = 0; i < Object.keys(positions).length; i++) {
			if (Object.keys(positions)[i] != id) {
				this.users[i].position.set(positions[Object.keys(positions)[i]].position[0],
					positions[Object.keys(positions)[i]].position[1],
					positions[Object.keys(positions)[i]].position[2]);
			}
		}
	}

	update() {
		requestAnimationFrame(() => this.update());
		this.controls.update(this.clock.getDelta());
		this.controls.target = new THREE.Vector3(0, 0, 0);
		this.render();
	}

	render() {
		//update remote video
		if (rvideo) {
			if (rvideo.readyState === rvideo.HAVE_ENOUGH_DATA) {
				rvideoImageContext.drawImage(rvideo, 0, 0, rvideoImage.width, rvideoImage.height);
				if (rvideoTexture)
					rvideoTexture.needsUpdate = true;
			}
		}
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
		this.controls.enabled = false;
	}
	onEnterCanvas(e) {
		this.controls.enabled = true;
	}
	onKeyDown(e) {
		socket.emit('move', [glScene.camera.position.x, glScene.camera.position.y, glScene.camera.position.z]);
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