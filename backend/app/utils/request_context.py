from flask import request


def booking_request_context():
    return {
        "ip_address": request.headers.get("X-Forwarded-For", request.remote_addr),
        "user_agent": request.headers.get("User-Agent", "unknown"),
    }
