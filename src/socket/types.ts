export interface User {
    id: string;
    username: string;
    ready: boolean;
    progress: number;
    finished: boolean;
    correctChars: number;
}

export interface GameData {
    textId: number;
    text: string;
    startTime: number;
}

export interface Room {
    name: string;
    users: Map<string, User>;
    gameState: 'waiting' | 'countdown' | 'playing' | 'finished';
    gameData?: GameData;
    timers: {
        countdown?: NodeJS.Timeout;
        game?: NodeJS.Timeout;
    };
}