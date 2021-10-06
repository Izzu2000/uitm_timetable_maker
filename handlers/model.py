from __future__ import annotations
import datetime
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict

from pydantic.main import BaseModel
from sqlalchemy import select, delete, literal_column
from sqlalchemy.dialects.postgresql import insert

from handlers.db import BranchCourse, basic_binding, CourseGroup

if TYPE_CHECKING:
    from handlers.fetcher import Handler


@dataclass
class Course:
    branch: str  # The first part of endpoint
    course: str  # second part of endpoint, will be added .html
    name: str  # save name to use, not for endpoint

    @classmethod
    def from_regex(cls, regex: re.Match):
        return cls(branch=regex['branch'], course=regex['course'], name=regex['name'])


class DataCache:
    def __init__(self, handler: Handler):
        self.handler = handler
        self.data = None
        self._last_update = None

    @staticmethod
    def is_expire(time, current_time):
        return (time + datetime.timedelta(days=1)) < current_time

    async def update_value(self, *args, **kwargs):
        raise NotImplementedError(f"{type(self).__name__} needs to override update_value")

    async def set_updated(self, *args, data=None, _last_update=None, **kwargs):
        self.data = data or await self.update_value(*args, **kwargs)
        self._last_update = _last_update or datetime.datetime.utcnow()

    async def get(self, *args, **kwargs):
        current_time = datetime.datetime.utcnow()
        if self._last_update is None or self.is_expire(self._last_update, current_time):
            await self.set_updated(*args, **kwargs)
        return self.data

    async def __call__(self, *args, **kwargs):
        return await self.get(*args, **kwargs)


class CampusList(DataCache):
    async def update_value(self):
        return await self.handler.fetch_campus_list()

    async def get(self):
        if not self.data:
            await self.set_updated()

        return await super().get()


class CampusCoursesList(DataCache):
    async def update_value(self, campus):
        data = await self.handler.fetch_campus_courses(campus)

        stmt = insert(BranchCourse).values(
            branch='$', course='$', name='$'
        ).on_conflict_do_nothing(
            index_elements=['branch', 'course']
        )

        query = basic_binding(stmt)
        form_values = [(campus, course.course, course.name) for course in data.values()]

        await self.handler.pool.executemany(query, form_values)

        return data


class CourseGroupsList(DataCache):
    @staticmethod
    def where_course():
        return (
                CourseGroup.course_id == select(BranchCourse.id)
                .where(*CourseGroupsList.derive_branch_course())
                .scalar_subquery()
        )

    @staticmethod
    def derive_branch_course():
        return BranchCourse.branch.like('$'), BranchCourse.course.like('$')

    async def is_expired(self, branch: str, course: str) -> bool:
        stmt = select(BranchCourse.fetch_at).where(*self.derive_branch_course())
        query = basic_binding(stmt)

        if not (fetch_at := await self.handler.pool.fetchval(query, branch, course)):
            return True

        return self.is_expire(fetch_at, datetime.datetime.utcnow())

    async def update_value(self, branch, course):
        stmt = select(CourseGroup).where(self.where_course())
        query = basic_binding(stmt)
        if fetched := await self.handler.pool.fetch(query, branch, course):
            if not await self.is_expired(branch, course):
                columns = CourseGroup.__table__.columns.keys()[1:]
                to_return = []
                for row in fetched:
                    to_return.append({column.capitalize(): row[column] for column in columns})

                return to_return

        fetched_value = await self.handler.fetch_course(branch, course)

        await self.insert_into_db(branch, course, fetched_value)

        return fetched_value

    async def insert_into_db(self, branch: str, course: str, fetched_value: Dict[str, Any]) -> None:
        delete_stmt = delete(CourseGroup).where(self.where_course())
        # We want to remove any removed courses in uitm [just in case]

        query = basic_binding(delete_stmt)
        await self.handler.pool.execute(query, branch, course)

        while True:
            selection = select(BranchCourse.id)\
                .where(*self.derive_branch_course())
            query = basic_binding(selection)

            if (course_id := await self.handler.pool.fetchval(query, branch, course)) is not None:
                break

            await self.handler.get_campus_courses(branch)

        columns = CourseGroup.__table__.columns.keys()[1:]  # offset for dummy primary key
        stmt = insert(CourseGroup).values({k: literal_column("'$'") for k in columns})

        query = basic_binding(stmt)
        values = [(course_id, *[dict_val[column_name.capitalize()] for column_name in columns[1:]])
                  for dict_val in fetched_value]
        await self.handler.pool.executemany(query, values)


class CampusParams(BaseModel):
    branch: str


class CourseParams(CampusParams):
    course: str


class UiTMRefuseException(Exception):
    def __init__(self):
        super().__init__("UiTM network is unavailable.")


class UiTMCampusNotValid(Exception):
    def __init__(self, branch: str):
        super().__init__(f"Branch {branch} is invalid")
