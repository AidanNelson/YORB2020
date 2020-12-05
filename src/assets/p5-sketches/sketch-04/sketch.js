/*
 * Welcome to the YORB !
 * This is where you can add your P5 sketch into the space!
 * In order to do so, please fill out the following configuration object,
 * then add your sketch below
 *
 */


window.yorbConfig = {
  // set this to true!
  active: true,

  name: "August Luhrs",
  
  description: "a rippling animation of IKEA bag pixels emanating from a YORB IKEA logo",

  // choose a shape on which to put your p5 sketch!
  // options are: box, sphere, cylinder, ico
  shape: "box",

  // set the position of your sketch within the 3D YORB space here:
  // to find out what position makes sense, go to yorb.itp.io,
  // open the javascript console, then navigate to where you want the sketch,
  // and press the 'p' key.  A series of coordinates should appear in your console,
  // then plug those values in here:
  position: {
    x: 6.16,
    y: 1.5,
    z: 12.6,
  },
  // set the rotation of your sketch here:
  rotation: {
    x: 0,
    y: 0,
    z: 0,
  },
  // set the scale of your sketch here (1-4 are reasonable values):
  scale: {
    x: .25,
    y: 3,
    z: 3,
  },
};




// Put your sketch below
//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//

myCoolSketch = (sketch) => {
  let pixel1, pixel2, pixel3, pixel4, pixel5;
  let ikeaPixels = [];
  let rotations = [0, 90, 180, 270];
  let ikeaLogo;

  //ripple variables
  let cols, rows;
  let pixelSize = 32;
  let pixelGrid = [];

  sketch.preload = () => {
    pixel1 = sketch.loadImage('ikeaBagPixel_1.png');
    pixel2 = sketch.loadImage('ikeaBagPixel_2.png');
    pixel3 = sketch.loadImage('ikeaBagPixel_3.png');
    pixel4 = sketch.loadImage('ikeaBagPixel_4.png');
    pixel5 = sketch.loadImage('ikeaBagPixel_5.png');
    ikeaLogo = sketch.loadImage('YORB_IKEA.png');
  }

  sketch.setup = () => {
    sketch.createCanvas(840,840);
    ikeaPixels = [pixel1, pixel2, pixel3, pixel4, pixel5];
    sketch.frameRate(8);
    sketch.angleMode(sketch.DEGREES);
    sketch.imageMode(sketch.CENTER);

    //set up the grid
    cols = 800/pixelSize;
    rows = 800/pixelSize;
    for(let i = 0; i < cols; i++){
      pixelGrid[i] = [];
      for(let j = 0; j < rows; j++){
        pixelGrid[i][j] = {
          id: [i, j],
          x: (i * pixelSize) + (pixelSize/2) + 20,
          y: (j * pixelSize) + (pixelSize/2) + 20,
          // col: floor(random(8)),
          swatch: 0, 
          hasFlipped: false
        };
      }
    }
    sketch.initGrid(pixelGrid[sketch.floor(cols/2)][sketch.floor(rows/2)], 0);
  }

  sketch.draw = () => {
    sketch.background(255);
    //yellow border
    sketch.fill(255,218,26); //ikea yellow
    sketch.rect(0,0, sketch.width, sketch.height);

    //ripple animation
    //clunky way of getting center pixel, needs odd num of rows/cols
    //also would prob work better to use previousGrid and get new swatch value
    //as an average of surrounding swatch values, but w/e, this works for now
    sketch.rippleGrid(pixelGrid[sketch.floor(cols/2)][sketch.floor(rows/2)]); 

    //then display and reset
    for(let x = 0; x < cols; x++){
      for(let y = 0; y < rows; y++){

        let thisPixel = pixelGrid[x][y];
        sketch.push();
        sketch.translate(thisPixel.x, thisPixel.y);
        sketch.rotate(sketch.random(rotations));
        sketch.image(ikeaPixels[thisPixel.swatch], 0, 0, pixelSize, pixelSize);
        sketch.pop();

        thisPixel.hasFlipped = false; //resetting
      }
    }   

    //ikea logo in center
    sketch.image(ikeaLogo, sketch.width/2, sketch.height/2, 3*sketch.width/4, sketch.height/3);
  }

  sketch.initGrid = (centerPixel, ring) => {
    //set up initial rings
    pixelGrid[centerPixel.id[0]][centerPixel.id[1]].hasFlipped = true;
    let pCol = centerPixel.id[0];
    let pRow = centerPixel.id[1];
    for (let i = pCol - ring; i <= pCol + ring; i++){
      if (i < 0 || i >= cols) continue; //prevent trying to access null array slots
      for (let j = pRow - ring; j <= pRow + ring; j++){
        if(j < 0 || j >= rows) continue;

        let thisPixel = pixelGrid[i][j];
        if(!thisPixel.hasFlipped){
          thisPixel.swatch = ring % ikeaPixels.length;
          thisPixel.hasFlipped = true;
        }
      }
    }
    if(ring + 1 < rows/2){
      sketch.initGrid(pixelGrid[sketch.floor(cols/2)][sketch.floor(rows/2)], ring+1);
    } else {
      // console.log("done init grid");
    }
  }

  sketch.rippleGrid = (centerPixel) => {
    let pCol = centerPixel.id[0];
    let pRow = centerPixel.id[1];

    //cycle through the 8 surrounding pixels
    for (let i = pCol - 1; i <= pCol + 1; i++){
      if (i < 0 || i >= cols) continue; //prevent trying to access null array slots
      for (let j = pRow - 1; j <= pRow + 1; j++){
        if(j < 0 || j >= rows) continue;
        if(!pixelGrid[i][j].hasFlipped){
          pixelGrid[i][j] = sketch.ripplePixelOut(pixelGrid[i][j]);
          //then continue out in all the other directions
          sketch.rippleGrid(pixelGrid[i][j]);
        }
      }
    }
  }

  //flipped so now animating from center out
  sketch.ripplePixelOut = (p) => {
    //make individual changes to color and hasFlipped
    if(p.swatch > 0){
      p.swatch--
    } else {
      p.swatch = ikeaPixels.length - 1;
    }
    p.hasFlipped = true;

    return p;
  }
}

let myp5 = new p5(myCoolSketch);
