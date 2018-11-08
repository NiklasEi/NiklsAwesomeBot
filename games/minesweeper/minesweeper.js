const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");
const head = document.getElementById("head");

const timer = document.getElementById("timer");

canvas.width = window.innerWidth;
// leave 60px for top margin
canvas.height = window.innerHeight - 60;
canvas.style.backgroundColor = "darkgray";

window.addEventListener('resize', resizeCanvas, false);

function resizeCanvas() {
    //canvas.width = window.innerWidth;
    //canvas.height = window.innerHeight;
    // ToDo prob best to not allow turned phone...
    // redraw();
}

let images = {};
preLoad();

const sizePerBox = 30;
const columns = Math.floor(canvas.width/sizePerBox);
const rows = Math.floor(canvas.height/sizePerBox);
const offsetX = Math.floor((canvas.width % sizePerBox)/2);
const offsetY = Math.floor((canvas.height % sizePerBox)/2);
const numberOfBombs = Math.floor((columns * rows) / 8);
let leftToUncover = (columns * rows) - numberOfBombs;
let flags = 0;
let running = false;
let started = false;


const grid = [];
for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
        grid.push({
            isBomb: false,
            isCovered: true,
            isFlagged: false,
            warning: 0,
            neighbors: getNeighbors(row, column),
            img: images.cover
        });
    }
}

console.log("Grid with " + grid.length + " slots and " + numberOfBombs + " bombs.");

for (let i = 0; i < numberOfBombs; i++) {
    let randColumn = Math.floor((Math.random() * columns));
    let randRow = Math.floor((Math.random() * rows));
    let slot = grid[randRow * columns + randColumn];
    if (slot.isBomb) {
        i--;
        continue;
    }
    slot.isBomb = true;
    for (let neighborSlot in slot.neighbors) {
        if (!slot.neighbors.hasOwnProperty(neighborSlot)) continue;
        grid[slot.neighbors[neighborSlot]].warning ++;
    }
}

function render() {
    for (let column = 0; column < columns; column++) {
        for (let row = 0; row < rows; row++) {
            let slot = grid[row * columns + column];
            draw(slot.img, column, row);
        }
    }
}

function draw(img, column, row) {
    ctx.drawImage(img, column * sizePerBox + offsetX, row * sizePerBox + offsetY, sizePerBox, sizePerBox);
}

function update() {
    document.title = "Mines: " + flags + "/" + numberOfBombs;
    head.innerText = "Mines: " + flags + "/" + numberOfBombs;
}

function getNeighbors(row, column) {
    let neighbors = [];
    // left, right, top, bottom
    if (column > 0) {
        neighbors.push(row * columns + column - 1)
    }
    if (row > 0) {
        neighbors.push((row - 1)* columns + column)
    }
    if (column < columns - 1) {
        neighbors.push(row * columns + column + 1)
    }
    if (row < rows - 1) {
        neighbors.push((row + 1)* columns + column)
    }
    // four corners
    if (column > 0 && row > 0) {
        neighbors.push((row - 1) * columns + column - 1)
    }
    if (column > 0 && row < rows - 1) {
        neighbors.push((row + 1)* columns + column - 1)
    }
    if (column < columns - 1 && row > 0) {
        neighbors.push((row - 1) * columns + column + 1)
    }
    if (column < columns - 1 && row < rows - 1) {
        neighbors.push((row + 1) * columns + column + 1)
    }
    return neighbors;
}

function start() {
    running = true;
    render();
    update();
    timer.innerText = "Click to start";
}
window.onload = start;

function uncover(x, y) {
    let slot = grid[y * columns + x];
    if (!slot.isCovered) return;
    if (slot.isFlagged) return;
    if (slot.isBomb) lost();
    else slot.img = images[slot.warning];
    slot.isCovered = false;
    if (leftToUncover === 1) won();
    else leftToUncover --;
    console.log("left: " + leftToUncover);
    draw(slot.img, x, y);
    if (slot.warning === 0) {
        collectSlotsToUncover(x, y);
        uncoverArea();
    }
}

let slotsToUncover = new Set();
function collectSlotsToUncover(x, y) {
    let slot = grid[y * columns + x];
    for (let i in slot.neighbors) {
        if (!slot.neighbors.hasOwnProperty(i)) continue;
        let slotToUncover = slot.neighbors[i];
        if (slotsToUncover.has(slotToUncover)) continue;
        if (grid[slotToUncover].isBomb) continue;
        if (grid[slotToUncover].isFlagged) continue;
        if (!grid[slotToUncover].isCovered) continue;
        slotsToUncover.add(slotToUncover);
        if ((grid[slotToUncover].warning === 0) && !grid[slotToUncover].isFlagged)
            collectSlotsToUncover(slotToUncover % columns, Math.floor(slotToUncover / columns));
    }
}

function uncoverArea() {
    for (let slotNum of slotsToUncover) {
        let slot = grid[slotNum];
        slot.isCovered = false;
        slot.img = images[slot.warning];
        leftToUncover --;
        console.log("left: " + leftToUncover);
        draw(slot.img, slotNum % columns, Math.floor(slotNum / columns))
    }
    if (leftToUncover === 1) won();
    slotsToUncover.clear();
}

function flag(x, y) {
    let slot = grid[y * columns + x];
    if (!slot.isCovered) return;
    if (slot.isFlagged) {
        flags --;
        slot.img = images.cover;
    } else {
        flags ++;
        slot.img = images.flag;
    }
    slot.isFlagged = !slot.isFlagged;
    draw(slot.img, x, y);
    update();
}

function lost() {
    uncoverAll();
    document.title = "You lost!";
    head.innerText = "You lost!";
    stopGame();
}

function won() {
    document.title = "You won!";
    head.innerText = "You won!";
    stopGame();
}

function stopGame() {
    running = false;
    clearTimeout(timerID);
}

function uncoverAll() {
    for (let column = 0; column < columns; column++) {
        for (let row = 0; row < rows; row++) {
            let slot = grid[row * columns + column];
            if (slot.isBomb) slot.img = images.mine;
            else slot.img = images[slot.warning];
            draw(slot.img, column, row);
        }
    }
}

function preLoad() {
    const cover = new Image();
    cover.src = "/assets/minesweeper/cover.png";
    const flagImg = new Image();
    flagImg.src = "/assets/minesweeper/flag.png";
    const mine = new Image();
    mine.src = "/assets/minesweeper/mine.png";
    const warning0 = new Image();
    warning0.src = "/assets/minesweeper/0.png";
    const warning1 = new Image();
    warning1.src = "/assets/minesweeper/1.png";
    const warning2 = new Image();
    warning2.src = "/assets/minesweeper/2.png";
    const warning3 = new Image();
    warning3.src = "/assets/minesweeper/3.png";
    const warning4 = new Image();
    warning4.src = "/assets/minesweeper/4.png";
    const warning5 = new Image();
    warning5.src = "/assets/minesweeper/5.png";
    const warning6 = new Image();
    warning6.src = "/assets/minesweeper/6.png";
    const warning7 = new Image();
    warning7.src = "/assets/minesweeper/7.png";
    const warning8 = new Image();
    warning8.src = "/assets/minesweeper/8.png";

    images = {
        cover: cover,
        flag: flagImg,
        mine: mine,
        0: warning0,
        1: warning1,
        2: warning2,
        3: warning3,
        4: warning4,
        5: warning5,
        6: warning6,
        7: warning7,
        8: warning8
    };
}

let time = 0;
let timerID;
function runTimer() {
    displayTime();
    timerID = setTimeout(runTimer, 1000);
    time ++;
}

function displayTime() {
    let minutes = Math.floor(time / 60);
    let seconds = time % 60;
    timer.innerText = (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
}

if('ontouchstart' in window) {
    canvas.addEventListener("touchstart", onTouchStart, false);
    canvas.addEventListener("touchend", onTouchEnd, false);
} else canvas.addEventListener("mousedown", onClick, false);

function onClick(event) {
    if (!running) return;
    if (!started) {
        started = true;
        runTimer();
    }

    let x = event.x;
    let y = event.y;

    x -= canvas.offsetLeft;
    y -= canvas.offsetTop;

    x -= offsetX;
    y -= offsetY;

    if (event.button === 0) uncover(Math.floor(x / sizePerBox), Math.floor(y / sizePerBox));
    if (event.button === 2) flag(Math.floor(x / sizePerBox), Math.floor(y / sizePerBox));
}

let currentTouchTimer;
let longTouchDuration = 500;
let ignoreTouchEnd = false;

function onTouchStart(event) {
    if (!started) {
        started = true;
        runTimer();
    }
    if (event.changedTouches.length === 1) { //one finger touch
        let touch = event.changedTouches[0];

        let x = touch.pageX;
        let y = touch.pageY;

        x -= canvas.offsetLeft;
        y -= canvas.offsetTop;

        x -= offsetX;
        y -= offsetY;

        currentTouchTimer = setTimeout(function() { touchFlag(Math.floor(x / sizePerBox), Math.floor(y / sizePerBox)); }, longTouchDuration);
        event.preventDefault();
    }
}

function touchFlag(x, y) {
    flag(x, y);
    ignoreTouchEnd = true;
}

function onTouchEnd(event) {
    if (event.changedTouches.length === 1) { //one finger touch
        let touch = event.changedTouches[0];

        let x = touch.pageX;
        let y = touch.pageY;

        x -= canvas.offsetLeft;
        y -= canvas.offsetTop;

        x -= offsetX;
        y -= offsetY;

        clearTimeout(currentTouchTimer);
        if (!ignoreTouchEnd) uncover(Math.floor(x / sizePerBox), Math.floor(y / sizePerBox));
        else ignoreTouchEnd = false;
        event.preventDefault();
    }
}
