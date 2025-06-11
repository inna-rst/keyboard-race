import type { User } from "../types.ts";

class UserManager {
    private usernames = new Set<string>();
    private socketToUsername = new Map<string, string>();
    private usernameToSocketId = new Map<string, string>();

    addUser(socketId: string, username: string): void {
        if (this.usernames.has(username)) {
            throw new Error('Username already taken');
        }

        this.usernames.add(username);
        this.socketToUsername.set(socketId, username);
        this.usernameToSocketId.set(username, socketId);
    }

    removeUser(socketId: string): string | null {
        const username = this.socketToUsername.get(socketId);
        if (!username) return null;

        this.usernames.delete(username);
        this.socketToUsername.delete(socketId);
        this.usernameToSocketId.delete(username);

        return username;
    }

    getUsernameBySocketId(socketId: string): string | null {
        return this.socketToUsername.get(socketId) || null;
    }

    getSocketIdByUsername(username: string): string | null {
        return this.usernameToSocketId.get(username) || null;
    }

    isUsernameAvailable(username: string): boolean {
        return !this.usernames.has(username);
    }

    createUser(socketId: string, username: string): User {
        return {
            id: socketId,
            username,
            ready: false,
            progress: 0,
            finished: false,
            correctChars: 0
        };
    }
}

export const userManager = new UserManager();