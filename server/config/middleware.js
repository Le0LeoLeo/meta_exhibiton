import cors from 'cors';
import express from 'express';

export function applyAppMiddleware(app, { requestBodyLimit }) {
  app.use(
    cors({
      origin: ['http://localhost:5173'],
      credentials: true,
    }),
  );

  app.use(express.json({ limit: requestBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));
}
