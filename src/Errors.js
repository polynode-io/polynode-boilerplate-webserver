/*
 * polynode-boilerplate-webserver
 *
 * Released under MIT license. Copyright 2019 Jorge Duarte Rodriguez <info@malagadev.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
 * to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies
 * or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 * $Id:$
 *
 * @flow
 * @format
 *
 */

class HTTPError extends Error {
  constructor(message, httpStatusCode, expose = null) {
    super(message);
    this.name = this.constructor.name;
    this.httpStatusCode = httpStatusCode;
    this.expose = expose;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends HTTPError {
  constructor(message, expose = null) {
    super(message, 400, expose || { code: 'BadRequestError', message: 'Bad Request Error' });
  }
}

class UnauthorizedError extends HTTPError {
  constructor(message, expose = null) {
    super(message, 401, expose || { code: 'UnauthorizedError', message: 'Unauthorized Error' });
  }
}

class ForbiddenError extends HTTPError {
  constructor(message, expose = null) {
    super(message, 403, expose || { code: 'ForbiddenError', message: 'Forbidden Error' });
  }
}

class NotFoundError extends HTTPError {
  constructor(message, expose = null) {
    super(message, 404, expose || { code: 'NotFoundError', message: 'Not Found Error' });
  }
}

class InternalServerError extends HTTPError {
  constructor(message, expose = null) {
    super(
      message,
      500,
      expose || { code: 'InternalServerError', message: 'Internal Server Error' }
    );
  }
}

class UnprocessableEntityError extends HTTPError {
  constructor(message, expose = null) {
    super(
      message,
      422,
      expose || { code: 'UnprocessableEntityError', message: 'Unprocessable Entity Error' }
    );
  }
}

module.exports = {
  HTTPError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  InternalServerError,
  UnprocessableEntityError,
};
