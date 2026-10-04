import { describe, expect, it, vi } from 'vitest';
import { sendInternalError } from './errorHandling.js';

describe('sendInternalError', () => {
  it('logs the original error without exposing it to the client', () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const logger = { error: vi.fn() };
    const error = new Error('provider body contains internal details');

    sendInternalError(res, error, {
      code: 'TTS_FAILED',
      message: 'TTS generation failed',
      logger,
      requestId: 'request-1',
    });

    expect(logger.error).toHaveBeenCalledWith('internal_error', error, {
      code: 'TTS_FAILED',
      requestId: 'request-1',
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      code: 'TTS_FAILED',
      message: 'TTS generation failed',
      requestId: 'request-1',
    });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('provider body');
  });

  it('reads the middleware request ID from response locals for existing callers', () => {
    const res = {
      locals: { requestId: 'request-from-middleware' },
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const logger = { error: vi.fn() };

    sendInternalError(res, new Error('private'), { logger });

    expect(res.json).toHaveBeenCalledWith({
      code: 'INTERNAL_ERROR',
      message: 'internal error',
      requestId: 'request-from-middleware',
    });
  });
});
