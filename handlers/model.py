import re
from dataclasses import dataclass

from pydantic.main import BaseModel


@dataclass
class Course:
    branch: str  # The first part of endpoint
    course: str  # second part of endpoint, will be added .html
    name: str  # save name to use, not for endpoint

    @classmethod
    def from_regex(cls, regex: re.Match):
        return cls(branch=regex['branch'], course=regex['course'], name=regex['name'])


class CampusParams(BaseModel):
    branch: str


class CourseParams(CampusParams):
    course: str


class UiTMRefuseException(Exception):
    def __init__(self):
        super().__init__("UiTM network is unavailable.")
