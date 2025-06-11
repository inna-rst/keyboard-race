import { MAXIMUM_USERS_FOR_ONE_ROOM } from "../config.js";
import type { Room, User } from "../types.ts";

class RoomManager {
    private rooms = new Map<string, Room>();

    createRoom(roomName: string): Room {
        if (this.rooms.has(roomName)) {
            throw new Error('Room already exists');
        }

        const room: Room = {
            name: roomName,
            users: new Map(),
            gameState: 'waiting',
            timers: {}
        };

        this.rooms.set(roomName, room);
        return room;
    }

    getRoom(roomName: string): Room | null {
        return this.rooms.get(roomName) || null;
    }

    deleteRoom(roomName: string): boolean {
        const room = this.rooms.get(roomName);
        if (room) {
            this.clearRoomTimers(room);
            return this.rooms.delete(roomName);
        }
        return false;
    }

    getAllRooms(): Room[] {
        return Array.from(this.rooms.values());
    }

    getAvailableRooms(): Room[] {
        return this.getAllRooms().filter(
            room => room.gameState === 'waiting' && room.users.size < MAXIMUM_USERS_FOR_ONE_ROOM
        );
    }

    getRoomInfo(roomName: string) {
        const room = this.getRoom(roomName);
        if (!room) return null;

        return {
            name: room.name,
            numberOfUsers: room.users.size,
            maxUsers: MAXIMUM_USERS_FOR_ONE_ROOM,
            gameState: room.gameState
        };
    }

    addUserToRoom(roomName: string, user: User): void {
        const room = this.getRoom(roomName);
        if (!room) {
            throw new Error('Room not found');
        }

        if (room.users.size >= MAXIMUM_USERS_FOR_ONE_ROOM) {
            throw new Error('Room is full');
        }

        if (room.gameState !== 'waiting') {
            throw new Error('Game is already in progress');
        }

        room.users.set(user.username, user);
    }

    removeUserFromRoom(roomName: string, username: string): boolean {
        const room = this.getRoom(roomName);
        if (!room) return false;

        const removed = room.users.delete(username);

        if (room.users.size === 0) {
            this.deleteRoom(roomName);
        }

        return removed;
    }

    isRoomEmpty(roomName: string): boolean {
        const room = this.getRoom(roomName);
        return !room || room.users.size === 0;
    }

    private clearRoomTimers(room: Room): void {
        if (room.timers.countdown) {
            clearTimeout(room.timers.countdown);
            room.timers.countdown = undefined;
        }
        if (room.timers.game) {
            clearTimeout(room.timers.game);
            room.timers.game = undefined;
        }
    }
}

export const roomManager = new RoomManager();