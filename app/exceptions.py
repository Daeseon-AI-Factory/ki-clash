"""Application exception hierarchy.

All custom exceptions inherit from AppError for consistent
error handling across the API.
"""

from fastapi import HTTPException, status


class AppError(Exception):
    """Base exception for all application errors."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, resource: str, resource_id: str) -> None:
        super().__init__(
            code="not_found",
            message=f"{resource} '{resource_id}' not found",
            status_code=404,
        )


class AuthenticationError(AppError):
    def __init__(self, message: str = "Invalid credentials") -> None:
        super().__init__(
            code="authentication_error",
            message=message,
            status_code=401,
        )


class ValidationError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(
            code="validation_error",
            message=message,
            status_code=422,
        )


class GameError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(
            code="game_error",
            message=message,
            status_code=400,
        )
