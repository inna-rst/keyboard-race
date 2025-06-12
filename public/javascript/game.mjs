import { appendRoomElement, updateNumberOfUsersInRoom, removeRoomElement } from "./views/room.mjs";
import { appendUserElement, changeReadyStatus, setProgress, removeUserElement } from "./views/user.mjs";
import { showInputModal, showResultsModal, showMessageModal } from "./views/modal.mjs";
import { addClass, removeClass } from "./helpers/dom-helper.mjs";

const username = sessionStorage.getItem("username");

if (!username) {
    window.location.replace("/signin");
}

const socket = io("", { query: { username } });

// DOM элементы
const roomsPage = document.getElementById("rooms-page");
const gamePage = document.getElementById("game-page");
const addRoomBtn = document.getElementById("add-room-btn");
const quitRoomBtn = document.getElementById("quit-room-btn");
const readyBtn = document.getElementById("ready-btn");
const roomNameElement = document.getElementById("room-name");
const timerElement = document.getElementById("timer");
const textContainer = document.getElementById("text-container");
const gameTimerElement = document.getElementById("game-timer");
const gameTimerSeconds = document.getElementById("game-timer-seconds");


let currentRoom = null;
let gameState = 'waiting'; // waiting, countdown, playing, finished
let gameText = '';
let userInput = '';
let gameTimer = null;
let countdownTimer = null;
let roomNameToCreate = '';


document.addEventListener('DOMContentLoaded', () => {
    showRoomsPage();
    setupEventListeners();
});


function setupEventListeners() {
    addRoomBtn.addEventListener('click', () => {
        showInputModal({
            title: 'Enter room name',
            onChange: (value) => {
                roomNameToCreate = value;
            },
            onSubmit: () => {
                createRoom(roomNameToCreate);
            }
        });
    });

    quitRoomBtn.addEventListener('click', () => {
        console.log('Leaving room and returning to rooms page');
        socket.emit('leave_room');
        showRoomsPage();
    });

    readyBtn.addEventListener('click', () => {
        socket.emit('toggle_ready');
    });

    document.addEventListener('keydown', handleKeyDown);
}


function createRoom(roomName) {
    if (!roomName || !roomName.trim()) {
        showMessageModal({
            message: 'Please enter a valid room name'
        });
        return;
    }

    const trimmedRoomName = roomName.trim();

    if (trimmedRoomName.length < 3) {
        showMessageModal({
            message: 'Room name must be at least 3 characters long'
        });
        return;
    }

    if (trimmedRoomName.length > 30) {
        showMessageModal({
            message: 'Room name must be no more than 30 characters long'
        });
        return;
    }

    if (!/^[a-zA-Z0-9\s_-]+$/.test(trimmedRoomName)) {
        showMessageModal({
            message: 'Room name can only contain letters, numbers, spaces, underscores and hyphens'
        });
        return;
    }

    console.log('Creating room:', trimmedRoomName);
    socket.emit('create_room', trimmedRoomName);
    roomNameToCreate = '';
}

function handleKeyDown(event) {
    if (gameState !== 'playing') return;

    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const key = event.key;

    if (key === 'Backspace') {
        event.preventDefault();
        if (userInput.length > 0) {
            userInput = userInput.slice(0, -1);
            updateTextDisplay();
            sendProgress();
        }
    } else if (key.length === 1) {
        event.preventDefault();
        userInput += key;
        updateTextDisplay();
        sendProgress();
    }
}

function updateTextDisplay() {
    if (!gameText) return;

    let html = '';
    for (let i = 0; i < gameText.length; i++) {
        const char = gameText[i];
        let className = '';

        if (i < userInput.length) {
            className = userInput[i] === char ? 'correct' : 'incorrect';
        } else if (i === userInput.length) {
            className = 'current';
        }

        const displayChar = char === ' ' ? '&nbsp;' : char;
        html += `<span class="${className}">${displayChar}</span>`;
    }

    textContainer.innerHTML = html;
}

function sendProgress() {
    if (!gameText) {
        console.warn('No game text available for progress calculation');
        return;
    }

    let correctChars = 0;
    let totalTypedChars = userInput.length;


    for (let i = 0; i < Math.min(userInput.length, gameText.length); i++) {
        if (userInput[i] === gameText[i]) {
            correctChars++;
        } else {
            break;
        }
    }

    console.log(`Progress calculation:`, {
        userInput: userInput,
        correctChars: correctChars,
        totalChars: gameText.length,
        progress: (correctChars / gameText.length) * 100
    });

    socket.emit('typing_progress', {
        input: userInput,
        correctChars: correctChars,
        totalTypedChars: totalTypedChars
    });
}


function showRoomsPage() {
    console.log('Showing rooms page');
    removeClass(roomsPage, 'display-none');
    addClass(gamePage, 'display-none');
    currentRoom = null;
    gameState = 'waiting';
    
    userInput = '';
    gameText = '';
    
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }

    socket.emit('get_rooms_list');
}


function showGamePage(roomName) {
    addClass(roomsPage, 'display-none');
    removeClass(gamePage, 'display-none');
    roomNameElement.textContent = roomName;
    currentRoom = roomName;
}


socket.on('username_taken', (message) => {
    showMessageModal({
        message: message,
        onClose: () => {
            sessionStorage.removeItem('username');
            window.location.replace('/signin');
        }
    });
});

socket.on('rooms_list', (rooms) => {
    console.log('Received rooms list:', rooms);

    if (currentRoom === null && !gamePage.classList.contains('display-none') === false) {
        updateRoomsList(rooms);
    }

});


socket.on('room_created', (room) => {
    console.log('Room created:', room);

    if (currentRoom === null && room && room.name) {
        const existingRoom = document.querySelector(`[data-room-name="${room.name}"]`);
        if (!existingRoom) {
            appendRoomElement({
                name: room.name,
                numberOfUsers: room.numberOfUsers || 0,
                onJoin: () => {
                    console.log('Joining room:', room.name);
                    socket.emit('join_room', room.name);
                }
            });
            
            const noRoomsMessage = document.querySelector('.no-rooms-message');
            if (noRoomsMessage) {
                noRoomsMessage.remove();
            }
        }
    }
});


socket.on('room_creation_error', (message) => {
    console.error('Room creation error:', message);
    showMessageModal({
        message: `Failed to create room: ${message}`
    });
});

socket.on('room_joined', (data) => {
    console.log('Joined room:', data);
    showGamePage(data.roomName);

    const usersWrapper = document.getElementById('users-wrapper');
    usersWrapper.innerHTML = '';

    data.users.forEach(user => {
        appendUserElement({
            username: user.username,
            ready: user.ready,
            isCurrentUser: user.username === username
        });
    });

    gameState = data.gameState;
});

socket.on('join_room_error', (message) => {
    console.error('Join room error:', message);
    showMessageModal({
        message: `Failed to join room: ${message}`
    });
});

socket.on('user_joined', (user) => {
    console.log('User joined:', user);
    appendUserElement({
        username: user.username,
        ready: user.ready,
        isCurrentUser: user.username === username
    });
});

socket.on('user_left', (username) => {
    console.log('User left:', username);
    removeUserElement(username);
});

socket.on('user_ready_changed', (data) => {
    console.log('User ready changed:', data);
    changeReadyStatus(data);

    if (data.username === username) {
        readyBtn.textContent = data.ready ? 'NOT READY' : 'READY';
        readyBtn.className = data.ready ? 'ready' : '';
    }
});

socket.on('room_users_updated', (data) => {
    console.log('Room users updated:', data);
    
    if (currentRoom === null && !roomsPage.classList.contains('display-none')) {
        updateNumberOfUsersInRoom(data);
    }
});


socket.on('room_removed', (roomName) => {
    console.log('Room removed:', roomName);
    
    if (currentRoom === null && !roomsPage.classList.contains('display-none')) {
        removeRoomElement(roomName);
    }
});


socket.on('countdown_started', (data) => {
    console.log('Countdown started:', data);
    gameState = 'countdown';
    gameText = data.text;

    addClass(readyBtn, 'display-none');
    addClass(quitRoomBtn, 'display-none');

    removeClass(timerElement, 'display-none');

    let timeLeft = data.seconds;
    timerElement.textContent = timeLeft;

    countdownTimer = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(countdownTimer);
            addClass(timerElement, 'display-none');
        }
    }, 1000);
});

socket.on('game_started', (data) => {
    console.log('Game started:', data);
    gameState = 'playing';
    userInput = '';

    removeClass(textContainer, 'display-none');
    removeClass(gameTimerElement, 'display-none');

    updateTextDisplay();

    let timeLeft = data.gameTime;
    gameTimerSeconds.textContent = timeLeft;

    gameTimer = setInterval(() => {
        timeLeft--;
        gameTimerSeconds.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(gameTimer);
        }
    }, 1000);
});

socket.on('progress_update', (data) => {
    console.log('Received progress update:', data);
    setProgress(data);
});

socket.on('game_ended', (data) => {
    console.log('Game ended:', data);
    gameState = 'finished';

    if (gameTimer) clearInterval(gameTimer);
    if (countdownTimer) clearInterval(countdownTimer);

    showResultsModal({
        usersSortedArray: data.results,
        onClose: () => {
            console.log('Results modal closed');
        }
    });
});

socket.on('room_reset', () => {
    console.log('Room reset');
    gameState = 'waiting';
    userInput = '';
    gameText = '';

    addClass(textContainer, 'display-none');
    addClass(gameTimerElement, 'display-none');
    addClass(timerElement, 'display-none');

    removeClass(readyBtn, 'display-none');
    removeClass(quitRoomBtn, 'display-none');

    readyBtn.textContent = 'READY';
    readyBtn.className = '';

    const userElements = document.querySelectorAll('.user');
    userElements.forEach(element => {
        const username = element.dataset.username;
        setProgress({ username, progress: 0 });
        changeReadyStatus({ username, ready: false });
    });
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    showMessageModal({
        message: 'Connection error. Please try refreshing the page.'
    });
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
    showMessageModal({
        message: `Error: ${error}`
    });
});

function updateRoomsList(rooms) {
    console.log('Updating rooms list with:', rooms);

    const roomsWrapper = document.getElementById('rooms-wrapper');
    
    // Очищаем только если мы действительно получили новый список
    if (Array.isArray(rooms)) {
        roomsWrapper.innerHTML = '';

        if (rooms.length === 0) {
            const noRoomsElement = document.createElement('div');
            noRoomsElement.className = 'no-rooms-message';
            noRoomsElement.textContent = 'No rooms available. Create one!';
            roomsWrapper.appendChild(noRoomsElement);
            return;
        }

        rooms.forEach(room => {
            if (room && room.name) {
                appendRoomElement({
                    name: room.name,
                    numberOfUsers: room.numberOfUsers || 0,
                    onJoin: () => {
                        console.log('Joining room:', room.name);
                        socket.emit('join_room', room.name);
                    }
                });
            }
        });
    }
}



