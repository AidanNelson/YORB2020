import * as THREE from "three";
import { create3DText, createSimpleText } from './utils';


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
        this.addCenterPiece();

    }


    addCircles(){

      // colorsssss //
      var colBlack = 0x000000;
      var colWhite = 0xffffff;
      var colGreen = 0xc6fc03;
      var colPink = 0xFB69B9;
      var colPurple = 0x9588CB;
      var colBlue = 0x05C1DA;



      this.drawCircle(8, 32, collightBlue, -2, 12, -15);
      this.drawCircle(6, 32, colmainBlue, 10, 20, -15);

      //med circles
      this.drawCircle(4, 32, coldarkBlue, 1, 10, -15);
      this.drawCircle(4, 32, colmainBlue, 10, 6, -15);

      //small circles
      this.drawCircle(2, 32, coldarkBlue, -10, 18, -15);
      this.drawCircle(1, 32, colmainPink, -3, 12, -15);


    }

    ///// Shape Helper Functions /////


    drawCircle(radius, numFaces, matColor, posX, posY, posZ, angle){
        // const circlegeometry = new THREE.CircleGeometry( radius, numFaces );
        // const circlematerial = new THREE.MeshBasicMaterial( { color: matColor } );
        // const circle = new THREE.Mesh( circlegeometry, circlematerial );
        // circle.position.set(posX, posY, posZ);
        // circle.rotateY(rotate);
        // this.scene.add( circle );


        const circlegeometry = new THREE.CircleGeometry( radius, numFaces );
        const circlematerial = new THREE.MeshBasicMaterial( { color: matColor } );
        const circle = new THREE.Mesh( circlegeometry, circlematerial );
        circle.position.set(posX, posY, posZ);
        circle.rotateY(angle);
        circle.lookAt(0,0,0);
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
            color: 0x000000,
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

            console.log("angle: ", angle);

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


        var colmainBlue = 0x4B4FF4;
        var coldarkBlue = 0x1250CC;
        var collightBlue = 0x05C1DA;
        var colmainPink = 0xFC3691;

        //test circle
        // const circlegeometry = new THREE.CircleGeometry( 5, 32 );
        // const circlematerial = new THREE.MeshBasicMaterial( { color: 0x000000 } );
        // const circle = new THREE.Mesh( circlegeometry, circlematerial );
        // circle.position.set(centerX, 0, centerZ);
        // circle.rotateY(angle);
        // circle.lookAt(0,0,0);
        // this.scene.add( circle );
        //this works!


        this.drawCircle(3.5, 32, colmainBlue, centerX, 4.5, centerZ, angle);

        let xshift_white = 30 * Math.cos(angle+0.15);
        let zshift_white = 30 * Math.sin(angle+0.15);
        this.drawCircle(3, 32, collightBlue, (xshift_white), 7, (zshift_white), angle);
        //console.log("circle: ", centerX);

        //med circles
        let xshift_green = 30 * Math.cos(angle-0.14);
        let zshift_green = 30 * Math.sin(angle-0.14);

        this.drawCircle(1, 32, collightBlue, (xshift_green), 4, (zshift_green), angle);

        let xshift_black1 = 30 * Math.cos(angle-0.20);
        let zshift_black1 = 30 * Math.sin(angle-0.20);
        this.drawCircle(2, 32, coldarkBlue, xshift_black1, 7, zshift_black1, angle);
        //
        // //small circles
        let xshift_black2 = 30 * Math.cos(angle+0.20);
        let zshift_black2 = 30 * Math.sin(angle+0.20);
        this.drawCircle(1, 32, colmainBlue, xshift_black2, 2, zshift_black2, angle);

        let xshift_pink = 30 * Math.cos(angle-0.12);
        let zshift_pink = 30 * Math.sin(angle-0.12);
        this.drawCircle(0.5, 32, colmainPink, (xshift_pink), 5, (zshift_pink), angle);


        //draw fence
        let xshift_black3 = 30 * Math.cos(angle+0.3);
        let zshift_black3 = 30 * Math.sin(angle+0.3);
        this.drawCircle(1, 32, coldarkBlue, xshift_black3, 2.5, zshift_black3, angle);

        //draw fence
        let xshift_black4 = 30 * Math.cos(angle+0.4);
        let zshift_black4 = 30 * Math.sin(angle+0.4);
        this.drawCircle(1, 32, coldarkBlue, xshift_black4, 2, zshift_black4, angle);

        //draw fence
        let xshift_black5 = 30 * Math.cos(angle+0.5);
        let zshift_black5 = 30 * Math.sin(angle+0.5);
        this.drawCircle(1, 32, coldarkBlue, xshift_black5, 2.5, zshift_black5, angle);

        //draw fence
        let xshift_black6 = 30 * Math.cos(angle+0.6);
        let zshift_black6 = 30 * Math.sin(angle+0.6);
        this.drawCircle(1, 32, coldarkBlue, xshift_black6, 2, zshift_black6, angle);



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


        // //add label
        // let textDepth = 0.1;
        // let curveSegments = 3;
        // let message, txt;
        //
        // message = 'Lydia Jessup!';
        //
        // // const loader = new THREE.FontLoader();
        // // const font = loader.load('../assets/fonts/helvetiker_regular_copy.typeface.json');
        //
        // const fontJson = require('../assets/fonts/helvetiker_regular_copy.typeface.json' );
        // const font = new THREE.Font( fontJson );
        //
        // // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, fontMesh
        // txt = create3DText(message, 0.25, textDepth, curveSegments, 0.01, 0.01, false, false, font);
        //
        // //draw fence
        // let font_xshift = 30 * Math.cos(angle+0.2);
        // let font_zshift = 30 * Math.sin(angle+0.2);
        //
        // txt.position.set(0, 0, 0);
        // //txt.rotateY(angle);
        // //txt.lookAt(0,0,0);
        // this.scene.add(txt);


//this isn't workinng
            //
            // const loader = new THREE.FontLoader();
            //
            // loader.load('../assets/fonts/helvetiker_regular_copy.typeface.json', (font) => {
            // //


            const fontJson = require('../assets/fonts/helvetiker_regular_copy.typeface.json' );
            const font = new THREE.Font( fontJson );

              const text = 'Lydia Jessup';

              const fontGeometry = new THREE.TextBufferGeometry(text, {
                font: font,
                size:  .25,
                height:  .01,
                curveSegments: 11,
                bevelEnabled: true,
                bevelThickness: 0.02,
                bevelSize: 0.01,
                bevelSegments: 6,
              });

              const fontMaterial = new THREE.MeshPhongMaterial( {color: 0xFC3691, flatShading: true} );
              const fontMesh = new THREE.Mesh(fontGeometry, fontMaterial);

              let font_xshift = 30 * Math.cos(angle+0.1);
              let font_zshift = 30 * Math.sin(angle+0.1);
              fontMesh.position.set(font_xshift, 1.5, font_zshift);
              fontMesh.rotateY(angle);
              fontMesh.lookAt(0,0,0);
              this.scene.add( fontMesh );

          //  });



        this.projectionScreenManager.addScreen(centerX,2,centerZ,0,2,0, scaleFactor);
    }


    addCenterPiece(){

      // add table

      // const tableGeometry = new THREE.CylinderBufferGeometry(1, 1, 2, 32, 1, false);
      // const tableMaterial = new THREE.MeshPhongMaterial({ color: 0xFB69B9, side: THREE.DoubleSide });
      // const table = new THREE.Mesh(tableGeometry, tableMaterial);
      // table.position.set(0, 0, 0);
      // //cylinder.lookAt(0,0,0);
      // this.scene.add(table);

      const centerGeometry = new THREE.SphereGeometry( 1, 32, 32 );
      const centerMaterial = new THREE.MeshPhongMaterial( {color: 0xFB69B9} );
      const center = new THREE.Mesh( centerGeometry, centerMaterial );
      center.position.set(0, 0, 0);
      this.scene.add( center );


      const fontJson = require('../assets/fonts/helvetiker_regular_copy.typeface.json' );
      const font = new THREE.Font( fontJson );

        const text = 'Circle Room';

        const fontGeometry = new THREE.TextBufferGeometry(text, {
          font: font,
          size:  .25,
          height:  .01,
          curveSegments: 11,
          bevelEnabled: true,
          bevelThickness: 0.01,
          bevelSize: 0.01,
          bevelSegments: 1,
        });

        const fontMaterial = new THREE.MeshPhongMaterial( {color: 0xc6fc03, flatShading: true} );
        const fontMesh = new THREE.Mesh(fontGeometry, fontMaterial);
        fontMesh.position.set(-1, 2, 0);

        this.scene.add( fontMesh );


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
