import AppError from '../utils/AppError.js';

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  let field = "field";
  let value = "";
  if (err.keyValue) {
    const keys = Object.keys(err.keyValue);
    field = keys.join(", ");
    value = Object.values(err.keyValue).join(", ");
  } else if (err.errmsg) {
    const match = err.errmsg.match(/(["'])(\\?.)*?\1/);
    value = match ? match[0] : "";
  } else if (err.message) {
    const match = err.message.match(/(["'])(\\?.)*?\1/);
    value = match ? match[0] : "";
  }

  if (field.includes("slug")) {
    return new AppError(`The URL slug '${value || "entered"}' is already in use by another product. Please customize the URL slug in the SEO section.`, 400);
  }
  if (field.includes("sku")) {
    return new AppError(`The SKU '${value || "entered"}' is already in use by another product. Please use a unique SKU.`, 400);
  }
  const message = `Duplicate ${field}: ${value}. Please use a unique value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors || {}).map((el) => el.message || el);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleZodError = (err) => {
  const errors = err.errors ? err.errors.map(el => el.message) : [err.message];
  const message = `Validation Error: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥', err);
    res.status(500).json({
      status: 'error',
      message: err.message || 'Something went wrong on the server!',
    });
  }
};

export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = { ...err };
  error.message = err.message;
  error.name = err.name;
  error.code = err.code;

  if (error.name === 'CastError' || err.name === 'CastError') error = handleCastErrorDB(err);
  if (error.code === 11000 || err.code === 11000) error = handleDuplicateFieldsDB(err);
  if (error.name === 'ValidationError' || err.name === 'ValidationError') error = handleValidationErrorDB(err);
  if (error.name === 'ZodError' || err.name === 'ZodError') error = handleZodError(err);

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error.isOperational ? error : err, res);
  } else {
    sendErrorProd(error, res);
  }
};
