import { NextResponse } from 'next/server';

/**
 * Returns a standard JSON success response.
 */
export function apiSuccess<T>(data: T, message: string = 'Success', status: number = 200) {
  return NextResponse.json(
    {
      status: 'success',
      message,
      data
    } as ApiResponse<T>,
    { status }
  );
}

/**
 * Returns a standard JSON error response.
 */
export function apiError(message: string, code: string, status: number) {
  return NextResponse.json(
    {
      status: 'error',
      message,
      code,
      data: null,
      error: message // Legacy support
    } as ApiResponse<null>,
    { status }
  );
}

/**
 * Returns a 401 Unauthorized error response.
 */
export function apiUnauthorized(message: string = 'Unauthorized') {
  return apiError(message, 'UNAUTHORIZED', 401);
}

/**
 * Returns a 400 Bad Request error response.
 */
export function apiBadRequest(message: string, code: string = 'INVALID_PARAMS') {
  return apiError(message, code, 400);
}

/**
 * Returns a 404 Not Found error response.
 */
export function apiNotFound(message: string = 'Not Found', code: string = 'NOT_FOUND') {
  return apiError(message, code, 404);
}

/**
 * Returns a 500 Server Error response.
 */
export function apiServerError(message: string = 'Server error, please try again', code: string = 'SERVER_ERROR') {
  return apiError(message, code, 500);
}
