const THREE = require("./libs/three.min.js");

export class ITPModel {
  constructor(scene) {
    this.scene = scene;
    this.createMaterials();
    this.loadFloorModel();

    this.collidableMeshList = [];
  }

  getCollidableMeshList() {
    return this.collidableMeshList;
  }
  // this method instantiates materials for various parts of the ITP floor model
  // wall, ceiling, floor
  createMaterials() {
    this.testMaterial = new THREE.MeshLambertMaterial({ color: 0xffff1a });

    // wall material:
    this.wallMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffe6,
    });

    // ceiling material
    this.ceilingMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });

    // floor material
    // https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_variations_phong.html
    let floorTexture = new THREE.TextureLoader().load("textures/floor.jpg");
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(1, 1);

    this.floorMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: floorTexture,
    });

    this.paintedMetalMaterial = new THREE.MeshLambertMaterial({
      color: 0x1a1a1a,
      flatShading: true,
    });

    this.windowShelfMaterial = new THREE.MeshLambertMaterial({
      color: 0x565656,
    });

    // https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_physical_transparency.html
    this.glassMaterial = new THREE.MeshLambertMaterial({
      color: 0xd9ecff,
      transparent: true,
      opacity: 0.25,
    });

    this.lightHousingMaterial = new THREE.MeshLambertMaterial({
      color: 0x111111,
    });

    this.lightDiffuserMaterial = new THREE.MeshLambertMaterial({
      color: 0xcccccc,
    });

    this.glassFixturingMaterial = new THREE.MeshLambertMaterial({
      color: 0x000000,
    });
    this.graniteBarMaterial = new THREE.MeshLambertMaterial({
      color: 0x000000,
    });
    // this.testMaterial = new THREE.MeshLambertMaterial({ color: 0xffff1a });

    // this.linkMaterial = new THREE.MeshLambertMaterial({ color: 0xb3b3ff });
    // this.linkVisitedMaterial = new THREE.MeshLambertMaterial({ color: 0x6699ff });

    // let paintedRoughnessTexture = new THREE.TextureLoader().load("textures/roughness.jpg");
    // paintedRoughnessTexture.wrapS = THREE.RepeatWrapping;
    // paintedRoughnessTexture.wrapT = THREE.RepeatWrapping;
    // paintedRoughnessTexture.repeat.set(5, 5);

    // // wall material:
    // this.wallMaterial = new THREE.MeshPhongMaterial({
    // 	color: 0xffffe6,
    // 	bumpMap: paintedRoughnessTexture,
    // 	bumpScale: 0.25,
    // 	specular: 0xfffff5,
    // 	reflectivity: 0.01,
    // 	shininess: 0.1,
    // 	envMap: null
    // });

    // // ceiling material
    // this.ceilingMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

    // // floor material
    // // https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_variations_phong.html
    // let floorTexture = new THREE.TextureLoader().load("textures/floor.jpg");
    // floorTexture.wrapS = THREE.RepeatWrapping;
    // floorTexture.wrapT = THREE.RepeatWrapping;
    // floorTexture.repeat.set(1, 1);

    // this.floorMaterial = new THREE.MeshPhongMaterial({
    // 	color: 0xffffff,
    // 	map: floorTexture,
    // 	bumpMap: floorTexture,
    // 	bumpScale: 0.005,
    // 	specular: 0xffffff,
    // 	reflectivity: 0.5,
    // 	shininess: 4,
    // 	envMap: null
    // });

    // this.paintedMetalMaterial = new THREE.MeshPhongMaterial({
    // 	color: 0x1a1a1a,
    // 	bumpMap: paintedRoughnessTexture,
    // 	bumpScale: 0.2,
    // 	specular: 0xffffff,
    // 	reflectivity: 0.01,
    // 	shininess: 1,
    // 	envMap: null
    // });

    // this.windowShelfMaterial = new THREE.MeshPhongMaterial({
    // 	color: 0xdddddd
    // });

    // // https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_physical_transparency.html
    // this.glassMaterial = new THREE.MeshPhysicalMaterial({
    // 	color: 0xD9ECFF,
    // 	metalness: 0.05,
    // 	roughness: 0,
    // 	alphaTest: 0.5,
    // 	depthWrite: false,
    // 	envMap: this.envMap,
    // 	envMapIntensity: 1,
    // 	transparency: 1, // use material.transparency for glass materials
    // 	opacity: 1,                        // set material.opacity to 1 when material.transparency is non-zero
    // 	transparent: true
    // });

    // this.lightHousingMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });

    // this.lightDiffuserMaterial = new THREE.MeshPhongMaterial({
    // 	color: 0xcccccc,
    // 	emissive: 0xffffff,
    // 	emissiveIntensity: 10,
    // 	specular: 0xffffff,
    // 	reflectivity: 0.01,
    // 	shininess: 1,
    // 	envMap: null
    // });

    // this.glassFixturingMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    // this.graniteBarMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
  }

  loadModel(
    _file,
    _material,
    _scale,
    _castShadow,
    _receiveShadow,
    _collidable = false
  ) {
    this.GLTFLoader.load(
      _file,
      (gltf) => {
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
        let name = _file.slice(11, _file.indexOf("."));
        scene.name = name;
        this.floorModelParts.push(scene);
      },
      undefined,
      function (e) {
        console.error(e);
      }
    );
  }

  loadFloorModel() {
    this.GLTFLoader = new THREE.GLTFLoader();
    let scaleFactor = 1.25;
    this.floorModelParts = [];
    this.matMode = 0;

    this.loadModel(
      "models/itp/ceiling.glb",
      this.ceilingMaterial,
      scaleFactor,
      true,
      false
    );
    this.loadModel(
      "models/itp/floor.glb",
      this.floorMaterial,
      scaleFactor,
      false,
      true,
      true
    );
    this.loadModel(
      "models/itp/glass-fixturing.glb",
      this.glassFixturingMaterial,
      scaleFactor,
      true,
      false
    );
    this.loadModel(
      "models/itp/glass.glb",
      this.glassMaterial,
      scaleFactor,
      false,
      false,
      true
    );
    this.loadModel(
      "models/itp/granite-bar.glb",
      this.graniteBarMaterial,
      scaleFactor,
      true,
      false,
      true
    );
    this.loadModel(
      "models/itp/ibeam.glb",
      this.paintedMetalMaterial,
      scaleFactor,
      true,
      false,
      true
    );
    // this.loadModel('models/itp/light-diffuser.glb', this.lightDiffuserMaterial, scaleFactor, false, false);
    // this.loadModel('models/itp/light-housing.glb', this.lightHousingMaterial, scaleFactor, false, false);
    // this.loadModel('models/itp/lighting-grid.glb', this.wallMaterial, scaleFactor, false, false);
    this.loadModel(
      "models/itp/walls.glb",
      this.wallMaterial,
      scaleFactor,
      true,
      false,
      true
    );
    this.loadModel(
      "models/itp/window-shelf.glb",
      this.windowShelfMaterial,
      scaleFactor,
      true,
      false
    );
    this.loadModel(
      "models/itp/wooden-bar.glb",
      this.floorMaterial,
      scaleFactor,
      true,
      true,
      true
    );
  }

  swapMaterials() {
    this.matMode++;
    if (this.matMode >= 3) {
      this.matMode = 0;
    }
    switch (this.matMode) {
      case 0:
        for (let i = 0; i < this.floorModelParts.length; i++) {
          let scene = this.floorModelParts[i];
          let mat = this.getMatFromName(scene.name);
          scene.traverse((child) => {
            if (child.isMesh) {
              child.material = mat;
            }
          });
        }
        break;

      case 1:
        for (let i = 0; i < this.floorModelParts.length; i++) {
          let scene = this.floorModelParts[i];
          if (scene.name == "floor" || scene.name == "glass") {
            continue;
          } else {
            scene.traverse((child) => {
              if (child.isMesh) {
                // https://stackoverflow.com/questions/43088424/setting-random-color-for-each-face-in-threejs-results-in-black-object
                let col = new THREE.Color(0xffffff);
                col.setHex(Math.random() * 0xffffff);
                let mat = new THREE.MeshLambertMaterial({ color: col });
                child.material = mat;
              }
            });
          }
        }
        break;

      case 2:
        for (let i = 0; i < this.floorModelParts.length; i++) {
          let scene = this.floorModelParts[i];
          if (scene.name == "floor" || scene.name == "glass") {
            continue;
          } else {
            scene.traverse((child) => {
              if (child.isMesh) {
                // https://stackoverflow.com/questions/43088424/setting-random-color-for-each-face-in-threejs-results-in-black-object
                let col = new THREE.Color(0xffffff);
                col.setHex(Math.random() * 0xffffff);
                let mat = new THREE.MeshPhongMaterial({
                  color: col,
                  reflectivity: 0.4,
                  shininess: 1,
                  envMap: this.envMap,
                });
                child.material = mat;
              }
            });
          }
        }
        break;
    }
  }

  getMatFromName(name) {
    let mat = null;
    switch (name) {
      case "ceiling":
        mat = this.ceilingMaterial;
        break;
      case "floor":
        mat = this.floorMaterial;
        break;
      case "glass-fixturing":
        mat = this.glassFixturingMaterial;
        break;
      case "glass":
        mat = this.glassMaterial;
        break;
      case "granite-bar":
        mat = this.graniteBarMaterial;
        break;
      case "ibeam":
        mat = this.paintedMetalMaterial;
        break;
      case "light-diffuser":
        mat = this.lightDiffuserMaterial;
        break;
      case "light-housing":
        mat = this.lightHousingMaterial;
        break;
      case "lighting-grid":
        mat = this.wallMaterial;
        break;
      case "walls":
        mat = this.wallMaterial;
        break;
      case "window-shelf":
        mat = this.windowShelfMaterial;
        break;
      case "wooden-bar":
        mat = this.floorMaterial;
        break;
    }

    return mat;
  }
}
