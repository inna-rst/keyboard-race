import { texts } from "../../data.js";

export class TextHelper {
    static getRandomText(): { id: number; content: string } {
        const randomIndex = Math.floor(Math.random() * texts.length);
        return {
            id: randomIndex,
            content: texts[randomIndex]
        };
    }

    static getTextById(id: number): string | null {
        if (id < 0 || id >= texts.length) {
            return null;
        }
        return texts[id];
    }

    static calculateTypingSpeed(correctChars: number, timeInSeconds: number): number {
        const wordsPerMinute = (correctChars / 5) / (timeInSeconds / 60);
        return Math.round(wordsPerMinute);
    }

    static calculateAccuracy(correctChars: number, totalChars: number): number {
        if (totalChars === 0) return 100;
        return Math.round((correctChars / totalChars) * 100);
    }
}