"""Payment request/response schemas."""

from pydantic import BaseModel


class CheckoutRequest(BaseModel):
    success_url: str
    cancel_url: str


class CheckoutResponse(BaseModel):
    session_id: str
    checkout_url: str


class AdFreeStatusResponse(BaseModel):
    ad_free: bool
