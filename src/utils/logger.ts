export enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
}

export class Logger {
    private static instance: Logger;
    private level: LogLevel = LogLevel.INFO;
    private prefix: string = 'FitGD |';

    private constructor() {
        // Detect environment
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
            this.level = LogLevel.NONE;
        }
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Set the log level explicitly
     * @param level The log level to set
     */
    setLevel(level: LogLevel): void {
        this.level = level;
    }

    /**
     * Log an error message (always logged unless level is NONE)
     * @param message Message to log
     * @param args Additional arguments
     */
    error(message: string, ...args: any[]): void {
        if (this.level >= LogLevel.ERROR) {
            console.error(`${this.prefix} ERROR: ${message}`, ...args);
        }
    }

    /**
     * Log a warning message
     * @param message Message to log
     * @param args Additional arguments
     */
    warn(message: string, ...args: any[]): void {
        if (this.level >= LogLevel.WARN) {
            console.warn(`${this.prefix} WARN: ${message}`, ...args);
        }
    }

    /**
     * Log an info message
     * @param message Message to log
     * @param args Additional arguments
     */
    info(message: string, ...args: any[]): void {
        if (this.level >= LogLevel.INFO) {
            console.log(`${this.prefix} ${message}`, ...args);
        }
    }

    /**
     * Log a debug message
     * @param message Message to log
     * @param args Additional arguments
     */
    debug(message: string, ...args: any[]): void {
        if (this.level >= LogLevel.DEBUG) {
            console.log(`${this.prefix} DEBUG: ${message}`, ...args);
        }
    }
}

export const logger = Logger.getInstance();
