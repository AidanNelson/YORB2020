
// where do you want your sketch to live in the space
window.yorbConfig = {
  type: "box", // other options are "box", "sphere", and 
  position: {
    x: 0,
    y: 2,
    z: 0
  },
  rotation: {
    x: 3,
    y: 1,
    z: 0
  },
  scale: {
    x: 1,
    y: 1,
    z: 1
  }
}


let grid;
let balls = [];

function setup() {
  createCanvas(500, 500);
  rectMode(CENTER);
  for (let i = 0; i < 300; i++) {
    let b = new Ball(random(-width / 2, width / 2), random(-height / 2, height / 2));
    balls.push(b);
  }
}



function draw() {
  let range = 50;
  background(0, 0, 200);
  noFill();
  ellipse(mouseX,mouseY,range*2,range*2);
  
  for (let i = 0; i < balls.length; i++) {
    balls[i].selected = false;
    balls[i].move();
  }

  push();
  translate(width / 2, height / 2);

  grid = new Grid(range, 10);
  for (let i = 0; i < balls.length; i++) {
    let ball = balls[i];
    grid.add(ball.x, ball.y, ball);
  }

  grid.display();
  let neighbors = grid.queryAtPoint(mouseX, mouseY);
  neighbors.forEach((ball) => {
    ball.selected = true;
  })
  
  

  for (let i = 0; i < balls.length; i++) {
    balls[i].display();
  }

  pop();
}

function mouseClicked() {
  console.log(grid.queryAtPoint(mouseX, mouseY).length);
}














class Grid {
  constructor(cellSize, halfGridSize) {

    this.cellSize = cellSize;
    this.cellSizeSquared= cellSize*cellSize;
    this.halfGridSize = halfGridSize;
    this.grid = []; // our array of arrays of objects

    this.center = {
      x: 0,
      y: 0
    };

    for (let i = -this.halfGridSize; i < this.halfGridSize; i++) {
      let column = [];
      for (let j = -this.halfGridSize; j < this.halfGridSize; j++) {
        column.push([]);
      }
      this.grid.push(column);
    }
  }

  queryAtPoint(x, y, range) {
    x -= width / 2;
    y -= height / 2;

    // console.log(`Querying grid at point ${x},${y}`)
    let xIndex = this.halfGridSize + floor(x / this.cellSize);
    let yIndex = this.halfGridSize + floor(y / this.cellSize);
    // console.log(`Grid index: ${xIndex},${yIndex}`)

    let neighbors = [];
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (this.grid[xIndex + i] && this.grid[xIndex + i][yIndex + j]) {
          neighbors = neighbors.concat(this.grid[xIndex + i][yIndex + j]);
        }
      }
    }
    
    neighbors = neighbors.filter((neighbor) => {
        let distSquared = getDistSquared(x,y,neighbor.x,neighbor.y)
        return distSquared <= this.cellSizeSquared;
    })
    return neighbors;
  }

  add(x, y, obj) {
    // console.log(`Adding object at ${x},${y}`)
    let xIndex = this.halfGridSize + floor(x / this.cellSize);
    let yIndex = this.halfGridSize + floor(y / this.cellSize);

    if (xIndex > 0 && xIndex < this.halfGridSize * 2 && yIndex >= 0 && yIndex < this.halfGridSize * 2) {
      this.grid[xIndex][yIndex].push(obj);
    } else {
      console.log('Out of bounds!');
    }
  }


  display() {
    for (let i = -this.halfGridSize; i < this.halfGridSize; i++) {
      for (let j = -this.halfGridSize; j < this.halfGridSize; j++) {
        let centerX = this.center.x + (i * this.cellSize) + this.cellSize / 2;
        let centerY = this.center.y + (j * this.cellSize) + this.cellSize / 2;

        noFill();
        stroke(255);
        strokeWeight(0.25);
        rect(centerX, centerY, this.cellSize, this.cellSize);
        fill(0);
        // ellipse(centerX, centerY, 2, 2);

      }
    }
  }
}

function getDistSquared(x1,y1,x2,y2){
  let a = x2-x1;
  let b = y2-y1;
  return a*a + b*b;
}

// Ball Class
class Ball {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.velocityX = random(-0.2,0.2);
    this.velocityY = random(-0.2,0.2);
    this.color = color(0, 0, 0);
    this.selected = false;
  }

  display() {
    if (this.selected) {
      fill(255, 255, 0);
    } else {
      noFill();
    }

    strokeWeight(0.5);
    ellipse(this.x, this.y, 5, 5);
  }

  move() {
    this.x += this.velocityX;
    this.y += this.velocityY;
    let buffer = 20;
    if (this.x > (width / 2) - buffer || this.x < (-width / 2) + buffer) {
      this.velocityX *= -1;
    }
    if (this.y > (height / 2) - buffer || this.y < (-height / 2) + buffer) {
      this.velocityY *= -1;
    }
  }
}