import type { Server, Socket } from "socket.io";
import { roomManager } from "./room-manager.js";
import { userManager } from "./user-manager.js";
import { gameManager } from "./game-manager.js";

interface ExtendedSocket extends Socket {
    username?: string;
    currentRoom?: string;
}

export function setupSocketEvents(io: Server, socket: ExtendedSocket): void {
    const { username } = socket.handshake.query;

    if (!username || typeof username !== 'string') {
        socket.emit('error', 'Username is required');
        return;
    }

    if (!userManager.isUsernameAvailable(username)) {
        socket.emit('username_taken', 'This username is already taken');
        return;
    }

    try {
        userManager.addUser(socket.id, username);
        socket.username = username;
        console.log(`User ${username} connected with socket ${socket.id}`);
    } catch (error) {
        socket.emit('username_taken', 'This username is already taken');
        return;
    }

    emitRoomsList(socket);

    socket.on('create_room', (roomName: string) => handleCreateRoom(io, socket, roomName));
    socket.on('join_room', (roomName: string) => handleJoinRoom(io, socket, roomName));
    socket.on('toggle_ready', () => handleToggleReady(io, socket));
    socket.on('leave_room', () => handleLeaveRoom(io, socket));
    socket.on('get_rooms_list', () => emitRoomsList(socket));
    socket.on('typing_progress', (data) => handleTypingProgress(io, socket, data));
    socket.on('disconnect', () => handleDisconnect(io, socket));
}

function handleCreateRoom(io: Server, socket: ExtendedSocket, roomName: string): void {
    if (!roomName || !socket.username) return;

    try {
        const room = roomManager.createRoom(roomName);

        handleJoinRoom(io, socket, roomName);

        io.emit('room_created', roomManager.getRoomInfo(roomName));
    } catch (error) {
        socket.emit('room_creation_error', 'Room name is invalid or already exists');
    }
}

function handleJoinRoom(io: Server, socket: ExtendedSocket, roomName: string): void {
    if (!socket.username) return;

    const room = roomManager.getRoom(roomName);
    if (!room) {
        socket.emit('join_room_error', 'Room not found');
        return;
    }

    try {
        if (socket.currentRoom) {
            handleLeaveRoom(io, socket);
        }

        const user = userManager.createUser(socket.id, socket.username);
        roomManager.addUserToRoom(roomName, user);

        socket.join(roomName);
        socket.currentRoom = roomName;

        socket.emit('room_joined', {
            roomName: room.name,
            users: Array.from(room.users.values()),
            gameState: room.gameState
        });

        socket.to(roomName).emit('user_joined', user);

        io.emit('room_users_updated', {
            roomName: room.name,
            userCount: room.users.size
        });

    } catch (error) {
        socket.emit('join_room_error', (error as Error).message);
    }
}

function handleToggleReady(io: Server, socket: ExtendedSocket): void {
    if (!socket.currentRoom || !socket.username) return;

    const room = roomManager.getRoom(socket.currentRoom);
    if (!room || room.gameState !== 'waiting') return;

    const user = room.users.get(socket.username);
    if (!user) return;

    user.ready = !user.ready;

    io.to(room.name).emit('user_ready_changed', {
        username: socket.username,
        ready: user.ready
    });

    if (gameManager.checkAllUsersReady(room)) {
        gameManager.startCountdown(room, io);
    }
}

function handleLeaveRoom(io: Server, socket: ExtendedSocket, sendRoomsList: boolean = true): void {
    if (!socket.currentRoom || !socket.username) return;

    const room = roomManager.getRoom(socket.currentRoom);
    if (!room) return;

    console.log(`User ${socket.username} leaving room "${socket.currentRoom}"`);

    socket.leave(room.name);
    roomManager.removeUserFromRoom(room.name, socket.username);

    socket.to(room.name).emit('user_left', socket.username);

    const roomName = socket.currentRoom;
    socket.currentRoom = undefined;


    if (roomManager.isRoomEmpty(roomName)) {
        console.log(`Room "${roomName}" is now empty and removed`);
        io.emit('room_removed', roomName);
    } else {
        io.emit('room_users_updated', {
            roomName: roomName,
            userCount: room.users.size
        });

        if (room.gameState === 'waiting' && gameManager.checkAllUsersReady(room)) {
            gameManager.startCountdown(room, io);
        } else if (room.gameState === 'playing') {
            gameManager.checkGameEnd(room, io);
        }
    }

    if (sendRoomsList) {
        emitRoomsList(socket);
        console.log(`Sent updated rooms list to ${socket.username}`);
    }
}


function handleTypingProgress(io: Server, socket: ExtendedSocket, data: { input: string; correctChars: number; totalTypedChars?: number }): void {
    if (!socket.currentRoom || !socket.username) return;

    const room = roomManager.getRoom(socket.currentRoom);
    if (!room || room.gameState !== 'playing') {
        console.warn(`Cannot process typing progress: invalid room state for ${socket.username}`);
        return;
    }

    console.log(`Processing typing progress for ${socket.username}:`, {
        input: data.input,
        correctChars: data.correctChars,
        roomName: room.name,
        gameText: room.gameData?.text
    });

    gameManager.updateUserProgress(room, socket.username, data.correctChars);

    const user = room.users.get(socket.username);
    if (!user) return;

    const progressData = {
        username: socket.username,
        progress: user.progress,
        finished: user.finished,
        correctChars: user.correctChars
    };

    console.log(`Emitting progress update:`, progressData);

    io.to(room.name).emit('progress_update', progressData);

    io.to(room.name).emit('user_progress_debug', {
        username: socket.username,
        input: data.input,
        correctChars: data.correctChars,
        progress: user.progress,
        textLength: room.gameData?.text.length
    });

    gameManager.checkGameEnd(room, io);
}


function handleDisconnect(io: Server, socket: ExtendedSocket): void {
    console.log(`User ${socket.username} disconnected`);

    if (socket.username) {
        userManager.removeUser(socket.id);

        if (socket.currentRoom) {
            handleLeaveRoom(io, socket);
        }
    }
}

function emitRoomsList(socket: ExtendedSocket): void {
    const availableRooms = roomManager.getAvailableRooms().map(room =>
        roomManager.getRoomInfo(room.name)
    );
    socket.emit('rooms_list', availableRooms);
}