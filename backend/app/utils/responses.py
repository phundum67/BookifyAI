from flask import jsonify


def success(message, data=None, status=200):
    return jsonify({"message": message, "data": data or {}, "errors": []}), status


def error(message, errors=None, status=400):
    return jsonify({"message": message, "data": {}, "errors": errors or []}), status
