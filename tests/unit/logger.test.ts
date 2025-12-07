import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LogLevel } from '../../foundry/module/utils/logger';

describe('Logger', () => {
    let consoleLogSpy: any;
    let consoleWarnSpy: any;
    let consoleErrorSpy: any;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        // Reset singleton state if possible or get instance and reset level
        // Since it's a singleton, we need to be careful. Ideally we'd have a reset method for testing.
        // We'll rely on setLevel.
        Logger.getInstance().setLevel(LogLevel.INFO);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should format info logs with prefix', () => {
        const logger = Logger.getInstance();
        logger.setLevel(LogLevel.INFO);
        logger.info('Test message');
        expect(consoleLogSpy).toHaveBeenCalledWith('FitGD | Test message');
    });

    it('should format debug logs with prefix and label', () => {
        const logger = Logger.getInstance();
        logger.setLevel(LogLevel.DEBUG);
        logger.debug('Test debug');
        expect(consoleLogSpy).toHaveBeenCalledWith('FitGD | DEBUG: Test debug');
    }); // Fixed typo here (added closing brace)

    it('should format warn logs with prefix and label', () => {
        const logger = Logger.getInstance();
        logger.setLevel(LogLevel.WARN);
        logger.warn('Test warn');
        expect(consoleWarnSpy).toHaveBeenCalledWith('FitGD | WARN: Test warn');
    });

    it('should format error logs with prefix and label', () => {
        const logger = Logger.getInstance();
        logger.setLevel(LogLevel.ERROR);
        logger.error('Test error');
        expect(consoleErrorSpy).toHaveBeenCalledWith('FitGD | ERROR: Test error');
    });

    it('should respect log levels', () => {
        const logger = Logger.getInstance();
        logger.setLevel(LogLevel.WARN);

        logger.debug('Hidden');
        logger.info('Hidden');
        logger.warn('Visible');
        logger.error('Visible');

        expect(consoleLogSpy).not.toHaveBeenCalled(); // Debug and Info use console.log in this implementation
        expect(consoleWarnSpy).toHaveBeenCalledWith('FitGD | WARN: Visible');
        expect(consoleErrorSpy).toHaveBeenCalledWith('FitGD | ERROR: Visible');
    });

    it('should handle arguments', () => {
        const logger = Logger.getInstance();
        logger.setLevel(LogLevel.INFO);
        const obj = { foo: 'bar' };
        logger.info('Test args', obj);
        expect(consoleLogSpy).toHaveBeenCalledWith('FitGD | Test args', obj);
    });
});
