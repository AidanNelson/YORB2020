const THREE = require("./libs/three.min.js");
require("./libs/pointerLockControls.js")(THREE);

export class YORBControls {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.raycaster = new THREE.Raycaster();

    this.collidableMeshList = [];
    this.setupControls();
    this.setupCollisionDetection();
  }

  lock() {
    this.controls.lock();
  }

  unlock() {
    this.controls.unlock();
  }

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

  update() {
    this.detectCollisions();
    this.updateControls();
  }

  getCollidables(){
    let collidableMeshList = [];
      this.scene.traverse( function( object ) {

        if ( object.isMesh ) {
          collidableMeshList.push(object);
        }
      } );
      return collidableMeshList;
  }

  // update for these controls, which are unfortunately not included in the controls directly...
  // see: https://github.com/mrdoob/three.js/issues/5566
  updateControls() {
    let speed = 50;
    if (this.controls.isLocked === true) {

      
      var origin = this.controls.getObject().position.clone();
      origin.y -= this.cameraHeight; // origin is at floor level

      this.raycaster.set(origin, new THREE.Vector3(0, -this.cameraHeight, 0));


      var intersectionsDown = this.raycaster.intersectObjects(
        this.getCollidables()
      );
      var onObject =
        intersectionsDown.length > 0 && intersectionsDown[0].distance < 0.1;

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

      if (onObject === true || true) {
        this.velocity.y = Math.max(0, this.velocity.y);
        this.canJump = true;
      }

      if (
        (this.velocity.x > 0 && !this.obstacles.left) ||
        (this.velocity.x < 0 && !this.obstacles.right)
      ) {
        this.controls.moveRight(-this.velocity.x * delta);
      }
      if (
        (this.velocity.z > 0 && !this.obstacles.backward) ||
        (this.velocity.z < 0 && !this.obstacles.forward)
      ) {
        this.controls.moveForward(-this.velocity.z * delta);
      }

      this.controls.getObject().position.y += this.velocity.y * delta; // new behavior

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

    for (var i = 0; i < pts.length; i++) {
      var pt = pts[i].clone();
      // pt.applyMatrix4(this.playerGroup.matrix);
      // pt.y += 1.0; // bias upward to head area of player

      this.raycaster.set(pt, dir);
      this.raycaster.layers.set(3);
      var collisions = this.raycaster.intersectObjects(this.getCollidables());

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
}
