
import { texts } from "../../data.js";
import { SECONDS_FOR_GAME, SECONDS_TIMER_BEFORE_START_GAME } from "../config.js";
import type { Room } from "../types.js";
import type { Server } from "socket.io";

class GameManager {
    checkAllUsersReady(room: Room): boolean {
        if (room.users.size < 2) return false;
        return Array.from(room.users.values()).every(user => user.ready);
    }

    startCountdown(room: Room, io: Server): void {
        room.gameState = 'countdown';

        const randomTextIndex = Math.floor(Math.random() * texts.length);
        const selectedText = texts[randomTextIndex];

        room.gameData = {
            textId: randomTextIndex,
            text: selectedText,
            startTime: Date.now() + SECONDS_TIMER_BEFORE_START_GAME * 1000
        };

        console.log(`Starting countdown for room ${room.name}, text: "${selectedText}"`);

        io.to(room.name).emit('countdown_started', {
            seconds: SECONDS_TIMER_BEFORE_START_GAME,
            textId: randomTextIndex,
            text: selectedText
        });

        room.timers.countdown = setTimeout(() => {
            this.startGame(room, io);
        }, SECONDS_TIMER_BEFORE_START_GAME * 1000);
    }

    startGame(room: Room, io: Server): void {
        room.gameState = 'playing';

        console.log(`Starting game for room ${room.name}`);

        room.users.forEach(user => {
            user.progress = 0;
            user.finished = false;
            user.correctChars = 0;
        });

        io.to(room.name).emit('game_started', {
            gameTime: SECONDS_FOR_GAME
        });

        room.timers.game = setTimeout(() => {
            this.endGame(room, io);
        }, SECONDS_FOR_GAME * 1000);
    }

    updateUserProgress(room: Room, username: string, correctChars: number): void {
        const user = room.users.get(username);
        if (!user || !room.gameData) {
            console.warn(`Cannot update progress: user ${username} not found or no game data`);
            return;
        }

        const previousProgress = user.progress;
        const previousCorrectChars = user.correctChars;

        user.correctChars = correctChars;
        user.progress = Math.min((correctChars / room.gameData.text.length) * 100, 100);
        user.finished = correctChars >= room.gameData.text.length;

        console.log(`Updated progress for ${username}:`, {
            correctChars: correctChars,
            textLength: room.gameData.text.length,
            progress: user.progress,
            finished: user.finished,
            previousProgress: previousProgress,
            previousCorrectChars: previousCorrectChars
        });
    }

    checkGameEnd(room: Room, io: Server): boolean {
        if (room.gameState !== 'playing') return false;

        const allFinished = Array.from(room.users.values()).every(user => user.finished);

        if (allFinished) {
            console.log(`All users finished in room ${room.name}`);
            if (room.timers.game) {
                clearTimeout(room.timers.game);
                room.timers.game = undefined;
            }
            this.endGame(room, io);
            return true;
        }

        return false;
    }

    endGame(room: Room, io: Server): void {
        room.gameState = 'finished';

        console.log(`Ending game for room ${room.name}`);

        const results = Array.from(room.users.values())
            .sort((a, b) => {
                if (b.correctChars !== a.correctChars) {
                    return b.correctChars - a.correctChars;
                }
                return b.progress - a.progress;
            })
            .map(user => ({
                username: user.username,
                correctChars: user.correctChars,
                progress: user.progress
            }));

        console.log('Game results:', results);

        io.to(room.name).emit('game_ended', {
            results: results.map(r => r.username),
            detailedResults: results
        });

        setTimeout(() => {
            this.resetRoom(room, io);
        }, 5000);
    }

    resetRoom(room: Room, io: Server): void {
        console.log(`Resetting room ${room.name}`);

        room.gameState = 'waiting';
        room.gameData = undefined;

        room.users.forEach(user => {
            user.ready = false;
            user.progress = 0;
            user.finished = false;
            user.correctChars = 0;
        });

        io.to(room.name).emit('room_reset');
    }

    calculateCorrectChars(userInput: string, gameText: string): number {
        let correctChars = 0;
        for (let i = 0; i < Math.min(userInput.length, gameText.length); i++) {
            if (userInput[i] === gameText[i]) {
                correctChars++;
            } else {
                break;
            }
        }
        return correctChars;
    }
}

export const gameManager = new GameManager();