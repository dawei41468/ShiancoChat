from enum import Enum
from typing import Dict

class Department(str, Enum):
    SENIOR_MANAGEMENT = "senior_management"
    GENERAL_OFFICE = "general_office"
    XISHAN_HOME = "xishan_home"
    KAKA_TIME = "kaka_time"
    AGIO_BUSINESS = "agio_business"
    AGIO_RD = "agio_rd"
    PRODUCTION_DEPT = "production_dept"

    @classmethod
    def get_translation(cls, department: str, lang: str = "zh") -> str:
        """Get localized department name"""
        return DEPARTMENT_TRANSLATIONS.get(lang, {}).get(department, department)

    @classmethod
    def get_all_translations(cls, lang: str = "zh") -> Dict[str, str]:
        """Get all department translations for a language"""
        return DEPARTMENT_TRANSLATIONS.get(lang, {})

    @classmethod
    def validate(cls, value: str) -> str:
        """Validate department values"""
        return cls(value).value  # Will raise ValueError if invalid

DEPARTMENT_TRANSLATIONS: Dict[str, Dict[str, str]] = {
    "en": {
        "senior_management": "Senior Management",
        "general_office": "GM Office",
        "xishan_home": "Shianco Home",
        "kaka_time": "Kaka Time",
        "agio_business": "Agio Sales",
        "agio_rd": "Agio R&D",
        "production_dept": "Production Department"
    },
    "zh": {
        "senior_management": "高层管理",
        "general_office": "总经办",
        "xishan_home": "锡山家居",
        "kaka_time": "咖咖时光",
        "agio_business": "Agio 业务",
        "agio_rd": "Agio 研发",
        "production_dept": "生产事业部"
    }
}

def get_department_name(department: Department, lang: str = "zh") -> str:
    """Get localized department name"""
    return DEPARTMENT_TRANSLATIONS.get(lang, {}).get(department.value, department.value)