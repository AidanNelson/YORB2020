// 100 days gallery module
// August Luhrs Jan/Feb 2020

import { Vector3 } from 'three'
import * as THREE from 'three'
import debugModule from 'debug';
const log = debugModule('YORB:DaysGallery');
const Place = require('../../utilities/tools/place.js'); //for generating the canvases along wall

// why folders in dist is better than one big folder:
// https://medium.com/hceverything/parcel-js-moving-static-resources-to-a-separate-folder-aef63a038cbd
const postsDir = require('../assets/images/100Days/resized/**/*.*');

/* postsDir STRUCTURE:

    postsDir = { 
        classroom: {
            account : {
                date: {
                    'file':  { //this is annoying, but it's done by require, not resizeScrapes...
                        .png:"file.png" 
                    }
                }
            }
        }
    }
*/

export class DaysGallery {
    constructor(scene, camera, mouse) {
        this.scene = scene; //where the magic happens
        this.gallery = undefined; //holds the canvas objects
        //for interaction, from Billy's projectionScreens.js
        this.camera = camera;
        this.mouse = mouse;
        this.shift_down = false; 
        this.raycaster = new THREE.Raycaster();
        this.selectedPost = null;
        let domElement = document.getElementById('scene-container')
        domElement.addEventListener('click', (e) => this.onMouseClick(e), false)
        window.addEventListener('keydown', (e) => this.onKeyDown(e), false)
        window.addEventListener('keyup', (e) => this.onKeyUp(e), false)
        //get it goinnn
        this.setup();
    }

    /*
     ~ * ~ * ~ * MAIN FUNCTION: SETUP
     ~ * ~ * ~ * 
     ~ * ~ * ~ * get posts from resized
     ~ * ~ * ~ * sort to get today's post
     ~ * ~ * ~ * generate canvases along the walls of the back classrooms
    */

    setup () {
        this.galleryTitle(); //place the gallery title on the wall outside the classrooms
        let sortedDates = this.sortPosts();
        let todaysPosts = this.getTodaysPosts(sortedDates);
        this.generateGallery(todaysPosts); //keeping classroom location info in relevant methods instead of whole class
    }

    
    /*
     ~ * ~ * ~ * SCRAPING AND SORTING
     ~ * ~ * ~ * 
     ~ * ~ * ~ * sort all the posts by date so we can grab today's post and later show by date
    */

    sortPosts () {
        let sortedDates = {}; //want this to be same structure as postsDir, but account object holds an array of dates
        
        //using for/of instead of foreach because ¯\_(ツ)_/¯ https://thecodebarbarian.com/for-vs-for-each-vs-for-in-vs-for-of-in-javascript.html
        for (let classroom of Object.keys(postsDir)){
            sortedDates[classroom] = {};
            for (let account of Object.keys(postsDir[classroom])) {
                sortedDates[classroom][account] = [];
                for (let date of Object.keys(postsDir[classroom][account])) {
                    sortedDates[classroom][account].push(date);
                }
                sortedDates[classroom][account] = sortedDates[classroom][account].sort((a, b) => {
                    return b-a
                });
            }
        }
        return sortedDates;
    }

    getTodaysPosts (sortedDates) {
        //for now, just getting the first image from the most recent post folder
        let todaysPosts = [];
        for (let classroom of Object.keys(sortedDates)) {
            let posts = []; //array for place function
            for (let account of Object.keys(sortedDates[classroom])) {
                let post = {};
                post[account] = Object.values(postsDir[classroom][account][sortedDates[classroom][account][0]]['0'])[0]; //get the file from posts dir that matches the first file in the most recent date in sorted, wow that triple 0 at the end is fucked uppp X_X
                posts.push(post);
            }
            let room = {}
            room[classroom] = posts;
            todaysPosts.push(room);
        }
        return todaysPosts;
    }

    /*
     ~ * ~ * ~ * GENERATE GALLERY
     ~ * ~ * ~ * 
     ~ * ~ * ~ * use the Place tool and the posts array 
     ~ * ~ * ~ * to generate canvases along the three back classrooms
    */

    generateGallery (posts) {
        if(posts.length != 0) { //to prevent place tool error of adding non-objects to scene if no gallery files
            let galleryGroup = new THREE.Group();
            let galleryGeometry = new THREE.BoxGeometry(1.5, 1.5, .2);
            //might want to eventually make this more programatic, but fine for now...
            //have to find by key since position in posts can change
            let kdPosts = ["","","","","","","","","","","","","","","","",""];
            let kcPosts = ["","","","","","","","","","","","","","",""];
            let paulaPosts = ["","","","","","","","","","","","","","",""];
            for (let section of Object.keys(posts)) {
                let sec = Object.keys(posts[section])[0];

                if(sec == 'kc'){
                    kcPosts = posts[section][sec];
                }
                if(sec == 'kd'){
                    kdPosts = posts[section][sec];
                }
                if(sec == 'paula'){
                    paulaPosts = posts[section][sec];
                }
            }
            
            //left classroom -- kd 17 incl kd
            let kdGroup = new THREE.Group();
            let southGroupKD = kdPosts.slice(0, 3);
            let westGroupKD = kdPosts.slice(3, 9);
            let northGroupKD = kdPosts.slice(9, 12);
            let eastGroupKD = kdPosts.slice(12, kdPosts.length);

            let southWallKD = Place.onWall(new Vector3(41.5, 2, 7.4), new Vector3(47, 2, 7.4), southGroupKD, galleryGeometry, {labelLocation: 'alternating'});
            let westWallKD = Place.onWall(new Vector3(47, 2, 7.4), new Vector3(47, 2, 18.4), westGroupKD, galleryGeometry, {labelLocation: 'alternating'});
            let northWallKD = Place.onWall(new Vector3(47, 2, 18.4), new Vector3(41.5, 2, 18.4), northGroupKD, galleryGeometry, {labelLocation: 'alternating'});
            let eastWallKD = Place.onWall(new Vector3(41.5, 2, 18.4), new Vector3(41.5, 2, 10), eastGroupKD, galleryGeometry, {labelLocation: 'alternating'});
            
            kdGroup.add(southWallKD, eastWallKD, northWallKD, westWallKD);

            //right classroom -- kc 15 incl. kc
            let kcGroup = new THREE.Group();
            let southGroupKC = kcPosts.slice(0, 3);
            let westGroupKC = kcPosts.slice(3, 8);
            let northGroupKC = kcPosts.slice(8, 11);
            let eastGroupKC = kcPosts.slice(11, kcPosts.length);

            let southWallKC = Place.onWall(new Vector3(41.5, 2, 19.5), new Vector3(47, 2, 19.5), southGroupKC, galleryGeometry, {labelLocation: 'alternating'});
            let westWallKC = Place.onWall(new Vector3(47, 2, 19.5), new Vector3(47, 2, 29.8), westGroupKC, galleryGeometry, {labelLocation: 'alternating'});
            let northWallKC = Place.onWall(new Vector3(47, 2, 29.8), new Vector3(41.5, 2, 29.8), northGroupKC, galleryGeometry, {labelLocation: 'alternating'});
            let eastWallKC = Place.onWall(new Vector3(41.5, 2, 29.8), new Vector3(41.5, 2, 20.9), eastGroupKC, galleryGeometry, {labelLocation: 'alternating'});
            
            kcGroup.add(southWallKC, eastWallKC, northWallKC, westWallKC);

            //third classroom -- paula 15 incl. p-- starts from west so last wall(see through) has least num of canvases
            let paulaGroup = new THREE.Group();
            let westGroupPaula = paulaPosts.slice(0, 5); //tight squeeze...
            let northGroupPaula = paulaPosts.slice(5, 8);
            let eastGroupPaula = paulaPosts.slice(8, 13);
            let southGroupPaula = paulaPosts.slice(13, paulaPosts.length);

            let westWallPaula = Place.onWall(new Vector3(39.5, 2, 21.9), new Vector3(39.5, 2, 29.8), westGroupPaula, galleryGeometry, {labelLocation: 'alternating'});
            let northWallPaula = Place.onWall(new Vector3(39.5, 2, 29.8), new Vector3(33.7, 2, 29.8), northGroupPaula, galleryGeometry, {labelLocation: 'alternating'});
            let eastWallPaula = Place.onWall(new Vector3(33.7, 2, 29.8), new Vector3(33.7, 2, 21.9), eastGroupPaula, galleryGeometry, {labelLocation: 'alternating'});
            let southWallPaula = Place.onWall(new Vector3(34.8, 2, 21.9), new Vector3(39.5, 2, 21.9), southGroupPaula, galleryGeometry, {labelLocation: 'alternating'});
            
            paulaGroup.add(southWallPaula, eastWallPaula, northWallPaula, westWallPaula);


            //add all groups to scene
            galleryGroup.add(kdGroup, kcGroup, paulaGroup) //prob not necessary but w/e
            this.scene.add(galleryGroup);
            //add to object to maybe reference later if need to update specific canvas?
            this.gallery = galleryGroup;
        }
    }

    /*
     ~ * ~ * ~ * INTERACTION
     ~ * ~ * ~ * 
     ~ * ~ * ~ * use Billy's Raycaster Shift-Click interaction from projectionScreens.js
     ~ * ~ * ~ * to generate pop up links from Aidan's index.js coordinate modals
    */

    makeInstagramLinkModal(account) {
        if (!document.getElementsByClassName('insta-modal')[0]) {
            // yorbScene.controls.pause();
            let modalEl = document.createElement('div');
            modalEl.className = 'project-modal';
            modalEl.id = 'insta_modal';

            let contentEl = document.createElement('div');
            contentEl.className = 'project-modal-content';

            let link = `https://instagram.com/${account}`;

            let linkEl = document.createElement('a');
            linkEl.href = link;
            linkEl.innerHTML = `Check out all of ${account}'s posts on Instagram!`;
            linkEl.target = '_blank';
            linkEl.rel = 'noopener noreferrer';

            let closeButton = document.createElement('button');
            closeButton.addEventListener('click', () => {
                modalEl.remove();
                // yorbScene.controls.resume();
            });
            closeButton.innerHTML = 'X';


            let spacerDiv = document.createElement('div');
            spacerDiv.innerHTML += "<br><br>"

            let spacerDiv2 = document.createElement('div');
            spacerDiv2.innerHTML += "<br><br>"

            contentEl.appendChild(closeButton);
            contentEl.appendChild(spacerDiv)
            contentEl.appendChild(linkEl);
            contentEl.appendChild(spacerDiv2)

            modalEl.appendChild(contentEl);
            document.body.appendChild(modalEl);
        }
    }

    checkGalleryCanvasCollisions() {
        this.raycaster.setFromCamera(this.mouse, this.camera);

        var intersects = this.raycaster.intersectObject(this.gallery, true);

        // if we have intersections, highlight them
        let thresholdDist = 7;
        if (intersects.length > 0) {
            if (intersects[0].distance < thresholdDist) {
                let post = intersects[0].object;
                this.selectedPost = post;
            } else {
                this.selectedPost = null;
            }
        } else {
            this.selectedPost = null;
        }
    }

    
    onMouseClick(e) {
        // log('gallery');
        // log(JSON.stringify(this.gallery));
        if(this.gallery != undefined){ //to prevent raycasting to empty gallery error
            this.checkGalleryCanvasCollisions();
            if (this.selectedPost && this.shift_down) {
                log('selected: ' + JSON.stringify(this.selectedPost.name));
                this.makeInstagramLinkModal(this.selectedPost.name);
                this.shift_down = false // reset this because the displayMedia dialog means we lose the onKeyUp event
            }
        }
    }

    onKeyDown(e) {
        if (e.keyCode == 16) {
            this.shift_down = true
        }
    }

    onKeyUp(e) {
        if (e.keyCode == 16) {
            this.shift_down = false
        }
    }

    /*
     ~ * ~ * ~ * TITLE // BANNER
     ~ * ~ * ~ * 
     ~ * ~ * ~ * use YG's yorblet.js/portal.js labels to make a big banner
    */

    galleryTitle () {
        const fontJson = require('../assets/fonts/helvetiker_regular_copy.typeface.json')
        const font = new THREE.Font(fontJson)
        const text = 'X Days of Making'

        const fontGeometry = new THREE.TextBufferGeometry(text, {
            font: font,
            size: .8,
            height: 0.01,
            curveSegments: 11,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.1,
            bevelSegments: 6,
        });

        const fontMaterial1 = new THREE.MeshBasicMaterial({ color: 0x18DD6C, flatShading: true })
        const fontMaterial2 = new THREE.MeshBasicMaterial({ color: 0x1250CC, flatShading: true })
        const fontMesh = new THREE.Mesh(fontGeometry, [fontMaterial1, fontMaterial2])

        fontMesh.position.set(39, 2.7, 8.5)
        fontMesh.lookAt(0, 2.6, 8.5)
        this.scene.add(fontMesh)
    }

}

/*
OLD FUNCTIONS -- I know I could probably just delete these, but I'm a hoarder

//goes along the classroom wall with a .5 gap between 
    generateGallery (posts, startPoint) {
        let currentSpot = startPoint.left;
        let room = 'left';
        let direction = 'west'
        //go through all posts (TODO -- might want to not just start at corner)


        //hacky because rushing -- TODO fix
        for (let post of posts) {
            if(post.classroom = "kd") {
                //add next canvas
                this.generateCanvas(post.post, currentSpot);
                //update spot by moving clockwise along boundaries towards cardinal directions (doors to room are on east side)
                [currentSpot, room, direction] = this.placeClockwise(currentSpot, room, direction);
            }
        }

        currentSpot = startPoint.right;
        room = 'right';
        direction = 'north';

        //this isn't working because of the wonky getTodaysPosts code -- should start over.
        for (let post of posts) {
            if(post.classroom == "kc") {
                //add next canvas
                this.generateCanvas(post.post, currentSpot);
                //update spot by moving clockwise along boundaries towards cardinal directions (doors to room are on east side)
                [currentSpot, room, direction] = this.placeClockwise(currentSpot, room, direction);
            }
        }
    }

    //for making each individual gallery "canvas"
    generateCanvas (post, spot) {
        const postTexture = new THREE.TextureLoader().load(post);
        const postGeometry = new THREE.BoxGeometry(1,1,1);
        const postMaterial = new THREE.MeshBasicMaterial({map: postTexture});
        var postCanvas = new THREE.Mesh(postGeometry, postMaterial);
        postCanvas.position.set(spot.x, spot.y, spot.z);
        this.scene.add(postCanvas);
    }

    placeClockwise (spot, room, direction) { //TODO -- make utility/tool?
        let boundaries = { //per classroom
            left: { x: [42, 47],
                    z: [7.4, 18]
                },
            right: {x: [42, 47],
                    z: [19.4, 30]
                }
        }

        let spacing = .5;
        let canvasSize = 1;
        let gap = spacing + canvasSize; //putting here for now since will change eventually

        if (direction == 'west') {
            if (spot.x + gap > boundaries[room]['x'][1]) {
                spot.x += canvasSize;
                return this.placeClockwise(spot, room, 'north');
            } else {
                spot.x += gap;
                return [spot, room, direction];
            }
        } else if (direction == 'north') {
            if (spot.z + gap > boundaries[room]['z'][1]) {
                spot.z += gap;
                return this.placeClockwise(spot, room, 'east');
            } else {
                spot.z += gap;
                return [spot, room, direction];
            }
        } else if (direction == 'east') {
            if (spot.x - gap < boundaries[room]['x'][0]) {
                spot.x -= gap;
                return this.placeClockwise(spot, room, 'south');
            } else {
                spot.x -= gap;
                return [spot, room, direction];
            }
        } else if (direction == 'south') {
            if (spot.z - gap < boundaries[room]['z'][0] + 2) { //have to account for door
                console.log('out of room in : ' + room);
                // spot = new Vector3(47, 2, 19); //starting in SW corner of right room
                // return this.placeClockwise(spot, 'right', 'north'); // move to right room
            } else {
                spot.z -= gap;
                return [spot, room, direction];
            }
        }
    }

    testPlace () {
        log(postsDir);
        // log(postsDir['kd']['100dayscoffee']['20101005']['0']);
        let startPoint = new Vector3(42, 2, 7.4);
        let endPoint = new Vector3(47, 2, 7.4);
        let assets = [
            Object.values(postsDir['kd']['100dayscoffee']['20101005']['0'])[0],
            Object.values(postsDir['kd']['100dayscoffee']['20210110']['0'])[0],
            Object.values(postsDir['kd']['100dayscoffee']['20101005']['0'])[0]
        ]
        let geometry = new THREE.BoxGeometry(1.5, 1.5, .2);
        let group = Place.onWall(startPoint, endPoint, assets, geometry);
        this.scene.add(group);

        let startPoint2 = new Vector3(47, 2, 7.4);
        let endPoint2 = new Vector3(47, 2, 18.4);
        let assets2 = [
            Object.values(postsDir['kd']['100dayscoffee']['20101005']['0'])[0],
            Object.values(postsDir['kd']['100dayscoffee']['20210110']['0'])[0],
            Object.values(postsDir['kd']['moving.drawing']['20210118']['0needsResize'])[0],
            Object.values(postsDir['kd']['100dayscoffee']['20101005']['0'])[0]
        ]
        let geometry2 = new THREE.BoxGeometry(1.5, 1.5, .2);
        let group2 = Place.onWall(startPoint2, endPoint2, assets2, geometry2);
        this.scene.add(group2);
    }

    setupTest(){ //just for testing flow, test cube in elevators

        // create the video element from url
        // let protoVideo = document.createElement( 'video' )
        // protoVideo.setAttribute('id', 'protoVideo')
        // protoVideo.src = "https://scontent-lga3-1.cdninstagram.com/v/t50.2886-16/125367180_843826916364667_3564841615660490363_n.mp4?_nc_ht=scontent-lga3-1.cdninstagram.com&_nc_cat=107&_nc_ohc=ImHrFkZ1GVkAX_-q_Ug&oe=5FB6A187&oh=51e86203ab5bf76414f27be6b0110138"
        // protoVideo.load() // must call after setting/changing source
        // protoVideo.loop = true
        // protoVideo.play()

        //loading video into texture
        // const protoVideoTexture = new THREE.VideoTexture( document.getElementById('protoVideo'))


        //loading photo from url
        // const protoTexture = new THREE.TextureLoader().load("https://scontent-lga3-1.cdninstagram.com/v/t51.2885-15/e35/125364127_1230307457348884_674277153923938623_n.jpg?_nc_ht=scontent-lga3-1.cdninstagram.com&_nc_cat=104&_nc_ohc=twpkkEj5BDAAX_svcnq&tp=18&oh=883284a6619ab238bde83e5cb291814f&oe=5FDD0EEE")
        // const protoTexture = new THREE.TextureLoader().load("https://scontent-lga3-1.cdninstagram.com/v/t51.2885-15/e35/55742633_587080988439344_46306404217687397_n.jpg?_nc_ht=scontent-lga3-1.cdninstagram.com&_nc_cat=108&_nc_ohc=reT_0gAvwvkAX_6CfaB&tp=1&oh=c6851409abc5764c2824f1c5a71d6921&oe=602083E2")
        const protoTexture = new THREE.TextureLoader().load(postsDir['kcconch']['20101005']['0']);

        //set up proto cube
        const protoGeometry = new THREE.BoxGeometry(1,1,1)
        // const protoMaterial = new THREE.MeshBasicMaterial({map: protoVideoTexture})
        const protoMaterial = new THREE.MeshBasicMaterial({map: protoTexture})

        var dayProto = new THREE.Mesh(protoGeometry, protoMaterial)

        dayProto.position.set(
            4.5,
            .5,
            0.5
        )
        // dayProto.position.set(this.location.center);

        this.scene.add(dayProto)
        console.log("PROTOTYPE ADDED")
    }

//go to resized folder and grab the most recent post for each student
    getTodaysPosts () {
        let allPosts = [];
        //sort the account dates so we know the most recent folder
        Object.keys(postsDir).forEach(classroom => {
            let unsorted = {};
            unsorted[classroom] = {};
            Object.keys(postsDir[classroom]).forEach(account => {
                    unsorted[classroom][account] = [];
                Object.keys(postsDir[classroom][account]).forEach(date => {
                    unsorted[classroom][account].push(date);
                });
            });
            allPosts.push(unsorted);
        });
        // console.log(JSON.stringify(allPosts) + '\n\n\n\n\n');
        allPosts.forEach(classroom => {
            //this is def weird
            console.log(classroom)
            Object.keys(classroom).forEach(classObj => {
                // console.log(JSON.stringify(classObj) + 'asdfd');
                console.log(classObj);
                Object.keys(classroom[classObj]).forEach(account => {
                    console.log(JSON.stringify(account) + account)
                    //prob a better way of doing this
                    // classroom[classObj][account].forEach(dateArray => {
                    //     console.log(dateArray)
                    //     console.log(JSON.stringify(account))
                    console.log(classroom[classObj][account])
                    // account[dateArray] = account[dateArray].sort((a, b) => {
                    classroom[classObj][account] = classroom[classObj][account].sort((a, b) => {
                    
                        return b-a
                    });
                    // });
                });
            });
        });
        //for now, just getting the first image from the most recent post folder
        let todaysPosts = [];
        allPosts.forEach(classroom => {
            Object.keys(classroom).forEach(classObj => {
                console.log(classObj)
                console.log(postsDir);
                Object.keys(classroom[classObj]).forEach(account => {
                    console.log(account);
                    // let accountName = Object.keys(account)[0];
                    todaysPosts.push({classroom: classObj, account: account, post: postsDir[classObj][account][classroom[classObj][account][0]]['0']});
                });
            });
        });

        return todaysPosts;
    }

    check () {
        log('checking postsDir');
        log(postsDir);
        return postsDir;
    }

    // async setupGrid(){
    setupGrid(){
        // console.log('set up gallery grid')
        // let bDocs = await this.db.asyncFind({type: 'B'});
        // console.log('after db load: ' + bDocs.length)
        //laborious way for now
        let index = 0;
        let xIndex = 0;
        let yIndex = 0;
        let zIndex = 0;
        // for (let b of bDocs){ //for each post b, find photos p
            // for (let p of b.links.imgs) { //just photos for now

        for (let b of testLinks){
            // log('b: ' + JSON.stringify(b));
            for (let p of b){
                //loading photo from url
                const photoTexture = new THREE.TextureLoader().load(p)
                // const photoTexture = new THREE.TextureLoader().load("https://scontent-lga3-1.cdninstagram.com/v/t51.2885-15/e35/55742633_587080988439344_46306404217687397_n.jpg?_nc_ht=scontent-lga3-1.cdninstagram.com&_nc_cat=108&_nc_ohc=reT_0gAvwvkAX_6CfaB&tp=1&oh=c6851409abc5764c2824f1c5a71d6921&oe=602083E2")

                //set up photo cube
                const photoGeometry = new THREE.BoxGeometry(1,1,1)
                const photoMaterial = new THREE.MeshBasicMaterial({map: photoTexture})
                var dayCanvas = new THREE.Mesh(photoGeometry, photoMaterial)

                //go along the grid set up in this.location
                if (index % (this.location.width * this.location.depth) == 0) {
                    yIndex++
                    xIndex = 0
                    zIndex = 0
                } else if (index % this.location.width == 0) {
                    xIndex = 0
                    zIndex++
                } else {
                    xIndex++
                }
                // log('index: ' + index + " " + xIndex + " " + yIndex + " " + zIndex)
                index++
            

                dayCanvas.position.set(
                    this.location.center.x + xIndex,
                    this.location.center.y + yIndex,
                    this.location.center.z + zIndex
                    )

                //add to scene
                this.scene.add(dayCanvas)
            }
        }
    }

    setupTest(){ //add to the scene

        // create the video element from url
        let protoVideo = document.createElement( 'video' )
        protoVideo.setAttribute('id', 'protoVideo')
        protoVideo.src = "https://scontent-lga3-1.cdninstagram.com/v/t50.2886-16/125367180_843826916364667_3564841615660490363_n.mp4?_nc_ht=scontent-lga3-1.cdninstagram.com&_nc_cat=107&_nc_ohc=ImHrFkZ1GVkAX_-q_Ug&oe=5FB6A187&oh=51e86203ab5bf76414f27be6b0110138"
        protoVideo.load() // must call after setting/changing source
        protoVideo.loop = true
        protoVideo.play()

        //loading video into texture
        const protoVideoTexture = new THREE.VideoTexture( document.getElementById('protoVideo'))


        //loading photo from url
        // const protoTexture = new THREE.TextureLoader().load("https://scontent-lga3-1.cdninstagram.com/v/t51.2885-15/e35/125364127_1230307457348884_674277153923938623_n.jpg?_nc_ht=scontent-lga3-1.cdninstagram.com&_nc_cat=104&_nc_ohc=twpkkEj5BDAAX_svcnq&tp=18&oh=883284a6619ab238bde83e5cb291814f&oe=5FDD0EEE")
        const protoTexture = new THREE.TextureLoader().load("https://scontent-lga3-1.cdninstagram.com/v/t51.2885-15/e35/55742633_587080988439344_46306404217687397_n.jpg?_nc_ht=scontent-lga3-1.cdninstagram.com&_nc_cat=108&_nc_ohc=reT_0gAvwvkAX_6CfaB&tp=1&oh=c6851409abc5764c2824f1c5a71d6921&oe=602083E2")

        //set up proto cube
        const protoGeometry = new THREE.BoxGeometry(1,1,1)
        const protoMaterial = new THREE.MeshBasicMaterial({map: protoVideoTexture})
        // const protoMaterial = new THREE.MeshBasicMaterial({map: protoTexture})


        var dayProto = new THREE.Mesh(protoGeometry, protoMaterial)

        dayProto.position.set(
            4.5,
            .5,
            0.5
        )
        // dayProto.position.set(this.location.center);

        this.scene.add(dayProto)
        console.log("PROTOTYPE ADDED")
    }
}
*/
