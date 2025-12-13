export const success = (data) => ({
  success: true,
  data
});

export const error = (code, message, statusCode = 400) => {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
};

export const notFound = (resource) =>
  error('NOT_FOUND', `${resource} not found`, 404);

export const validationError = (message) =>
  error('VALIDATION_ERROR', message, 400);

export const conflict = (message) =>
  error('CONFLICT', message, 409);

export const unauthorized = (message = 'Authentication required') =>
  error('UNAUTHORIZED', message, 401);
