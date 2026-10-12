import type { Response } from 'supertest';
import type { ErrorBody } from './http';

export interface ExpectedEnvelope {
  status: number;
  code: string;
  fieldErrors?: string[];
}

export function expectErrorEnvelope(
  response: Response,
  expected: ExpectedEnvelope,
): ErrorBody {
  const body = response.body as ErrorBody;
  expect(response.status).toBe(expected.status);
  expect(body.statusCode).toBe(expected.status);
  expect(body.code).toBe(expected.code);
  expect(typeof body.message).toBe('string');
  expect(body.message.length).toBeGreaterThan(0);
  expect(typeof body.requestId).toBe('string');
  expect(body.requestId!.length).toBeGreaterThanOrEqual(8);
  expect(response.headers['x-request-id']).toBe(body.requestId);
  if (expected.fieldErrors) {
    expect(Object.keys(body.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(expected.fieldErrors),
    );
    for (const messages of Object.values(body.fieldErrors ?? {})) {
      expect(Array.isArray(messages)).toBe(true);
      for (const message of messages) expect(typeof message).toBe('string');
    }
  }
  return body;
}
