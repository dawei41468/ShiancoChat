from pydantic import BaseModel, validator
import re

class PasswordValidator:
    @staticmethod
    def validate_complexity(password: str) -> bool:
        """Validate password meets complexity requirements"""
        if len(password) < 12:
            return False
        if not re.search(r'[A-Z]', password):
            return False
        if not re.search(r'[a-z]', password):
            return False
        if not re.search(r'[0-9]', password):
            return False
        if not re.search(r'[^A-Za-z0-9]', password):
            return False
        return True

    @staticmethod
    def validate_strength(password: str) -> bool:
        """Additional strength validation (optional)"""
        # Could implement zxcvbn or similar here
        return True