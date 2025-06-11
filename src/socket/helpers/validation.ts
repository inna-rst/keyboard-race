export class ValidationHelper {
    static isValidUsername(username: string): boolean {
        return typeof username === 'string' &&
            username.trim().length >= 2 &&
            username.trim().length <= 20 &&
            /^[a-zA-Z0-9_-]+$/.test(username.trim());
    }

    static isValidRoomName(roomName: string): boolean {
        return typeof roomName === 'string' &&
            roomName.trim().length >= 3 &&
            roomName.trim().length <= 30 &&
            /^[a-zA-Z0-9\s_-]+$/.test(roomName.trim());
    }

    static sanitizeInput(input: string): string {
        return input.trim().replace(/[<>\"']/g, '');
    }
}