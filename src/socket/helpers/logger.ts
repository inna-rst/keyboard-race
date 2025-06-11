export class Logger {
    static info(message: string, data?: any): void {
        console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data || '');
    }

    static error(message: string, error?: any): void {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
    }

    static debug(message: string, data?: any): void {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, data || '');
        }
    }
}