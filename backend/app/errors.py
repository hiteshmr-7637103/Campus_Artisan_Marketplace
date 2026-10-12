import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("app")


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exc(request: Request, exc: StarletteHTTPException):
        return JSONResponse({"error": str(exc.detail)}, status_code=exc.status_code, headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def validation_exc(request: Request, exc: RequestValidationError):
        # Report field names and messages only; never echo submitted values (could be passwords).
        details = [
            {"field": ".".join(str(p) for p in e["loc"][1:]) or str(e["loc"][0]), "message": e["msg"]}
            for e in exc.errors()
        ]
        first = details[0] if details else {"field": "", "message": "invalid request"}
        return JSONResponse(
            {"error": f"{first['field']}: {first['message']}".strip(": "), "details": details},
            status_code=422,
        )

    @app.exception_handler(RateLimitExceeded)
    async def rate_exc(request: Request, exc: RateLimitExceeded):
        return JSONResponse({"error": "Too many requests. Please try again later."}, status_code=429)

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        log.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse({"error": "Internal server error"}, status_code=500)
