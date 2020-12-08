import * as THREE from "three";

export class Yorblet {
    constructor(scene, projectionScreenManager) {
        this.scene = scene;
        this.projectionScreenManager = projectionScreenManager;
        this.setup();

    }

    setup() {
        this.addCylindricalRoom()
        // this.addSquareRoom();
        //this.addPerformanceRoom();

        this.addFloor();

    }


    addCircles(){

      // colorsssss //
      var colBlack = 0x000000;
      var colWhite = 0xffffff;
      var colGreen = 0xc6fc03;
      var colPink = 0xFB69B9;
      var colPurple = 0x9588CB;
      var colBlue = 0x05C1DA;


      this.drawCircle(8, 32, colPurple, -2, 12, -15);
      this.drawCircle(6, 32, colWhite, 10, 20, -15);

      //med circles
      this.drawCircle(4, 32, colGreen, 1, 10, -15);
      this.drawCircle(4, 32, colBlack, 10, 6, -15);

      //small circles
      this.drawCircle(2, 32, colBlack, -10, 18, -15);
      this.drawCircle(1, 32, colPink, -3, 12, -15);


    }

    ///// Shape Helper Functions /////


    drawCircle(radius, numFaces, matColor, posX, posY, posZ, rotate){
        const circlegeometry = new THREE.CircleGeometry( radius, numFaces );
        const circlematerial = new THREE.MeshBasicMaterial( { color: matColor } );
        const circle = new THREE.Mesh( circlegeometry, circlematerial );
        circle.position.set(posX, posY, posZ);
        circle.rotateY(rotate);
        this.scene.add( circle );

      }



    addDoor(centerX,centerY,centerZ,lookAtX,lookAtY,lookAtZ){
        const doorGeometry = new THREE.BoxBufferGeometry(1,2,0.1);
        const doorMat = new THREE.MeshLambertMaterial({color: 0x000000});
        const doorMesh = new THREE.Mesh(doorGeometry, doorMat);
        doorMesh.position.set(centerX,centerY,centerZ);
        doorMesh.lookAt(lookAtX,lookAtY,lookAtZ);
        this.scene.add(doorMesh);
    }

    addSquareRoom(){
        const cubeGeometry = new THREE.BoxBufferGeometry(36,10,36);
        const wallMat = new THREE.MeshLambertMaterial({
            color: 0xffffe6,
            side: THREE.DoubleSide
        });
        const ceilingMat = new THREE.MeshLambertMaterial({
            color: 0x0000ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5
        })
        const cubeMesh = new THREE.Mesh(cubeGeometry,[
            wallMat,
            wallMat,
            ceilingMat,
            wallMat,
            wallMat,
            wallMat
        ]);
        cubeMesh.position.set(0,4.95,0);
        this.scene.add(cubeMesh);

        this.addPresentationStage(-12,-12);
        this.addPresentationStage(-12, 12);
        this.addPresentationStage( 12,-12);
        this.addPresentationStage( 12, 12);

        this.addDoor(18,1,0,0,1,0);
    }

    addFloor(){
         // add the ITP floor
         const floorTexture = new THREE.TextureLoader().load(require('../assets/images/textures/floor.jpg'))
         floorTexture.wrapS = THREE.RepeatWrapping
         floorTexture.wrapT = THREE.RepeatWrapping
         floorTexture.repeat.set(10, 10)

         const floorGeometry = new THREE.PlaneBufferGeometry(128, 128, 1, 1)
         const floorMaterial = new THREE.MeshBasicMaterial({ map: floorTexture, side: THREE.DoubleSide })
         const plane = new THREE.Mesh(floorGeometry, floorMaterial)
         plane.lookAt(0, 1, 0)
         this.scene.add(plane)
    }

    addCylindricalRoom() {
        const cylinderGeometry = new THREE.CylinderBufferGeometry(36,36, 10, 32, 1, true, 0, Math.PI * 1.95)
        const cylinderMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffe6,
            side: THREE.DoubleSide
        })
        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        this.scene.add(cylinder)

        // https://stackoverflow.com/questions/24273990/calculating-evenly-spaced-points-on-the-perimeter-of-a-circle
        let numProjects = 8;
        let radius = 30;
        for (let i = 0; i < numProjects; i++){
            let theta = ((Math.PI * 2) / numProjects);
            let angle = (theta * i);

            let centerX = radius * Math.cos(angle);
            let centerZ = radius * Math.sin(angle);
            this.addPresentationStage(centerX, centerZ, 1, angle);
        }

    }

    addPresentationStage(centerX, centerZ, scaleFactor = 1, angle) {
        const cylinderGeometry = new THREE.CylinderBufferGeometry(3 * scaleFactor, 3* scaleFactor, 1, 32, 1, false)
        const cylinderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        cylinder.position.set(centerX, 0, centerZ)
        //cylinder.lookAt(0,0,0);
        this.scene.add(cylinder)


        //testing stage

        // colorsssss //
        var colBlack = 0x000000;
        var colWhite = 0xffffff;
        var colGreen = 0xc6fc03;
        var colPink = 0xFB69B9;
        var colPurple = 0x9588CB;
        var colBlue = 0x05C1DA;



        //test circle

        const circlegeometry = new THREE.CircleGeometry( 5, 32 );
        const circlematerial = new THREE.MeshBasicMaterial( { color: 0x000000 } );
        const circle = new THREE.Mesh( circlegeometry, circlematerial );
        circle.position.set(centerX, 0, centerZ);
        circle.rotateY(angle);
        circle.lookAt(0,0,0);
        this.scene.add( circle );
        //this works!


        // this.drawCircle(8, 32, colPurple, (centerX-2), (12), (centerZ-15), angle);
        // this.drawCircle(6, 32, colWhite, (centerX+10), 20, (centerZ-15), angle);
        //
        // //med circles
        // this.drawCircle(4, 32, colGreen, (centerX+1), 10, (centerZ-15), angle);
        // this.drawCircle(4, 32, colBlack, (centerX+10), 6, (centerZ-15), angle);
        //
        // //small circles
        // this.drawCircle(2, 32, colBlack, (centerX-10), 18, (centerZ-15), angle);
        // this.drawCircle(1, 32, colPink, (centerX-3), 12, (centerZ-15), angle);

        this.projectionScreenManager.addScreen(centerX,2,centerZ,0,2,0, scaleFactor);
    }

    addPerformanceRoom(){
        const sphereGeometry = new THREE.SphereBufferGeometry( 32, 32, 32 );
        const sphereMaterial = new THREE.MeshBasicMaterial( {color: 0x2323ff, side: THREE.DoubleSide} );
        const sphere = new THREE.Mesh( sphereGeometry, sphereMaterial );

        // https://stackoverflow.com/questions/31539130/display-wireframe-and-solid-color
        // wireframe
        const slightlySmallerSphereGeo = new THREE.SphereBufferGeometry( 31.95, 32, 32 );
        var geo = new THREE.EdgesGeometry( slightlySmallerSphereGeo ); // or WireframeGeometry
        var mat = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 2 } );
        var wireframe = new THREE.LineSegments( geo, mat );
        sphere.add( wireframe );

        this.scene.add( sphere );


        const cylinderGeometry = new THREE.CylinderBufferGeometry(5, 5, 1, 32, 1, false)
        const cylinderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        cylinder.position.set(0, 0, -10)
        this.scene.add(cylinder)


        this.projectionScreenManager.addScreen(0,6,-10,0,2,0, 3);
    }
}
