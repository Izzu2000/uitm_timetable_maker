import itertools

from sqlalchemy import Column, String, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class BranchCourse(Base):
    __tablename__ = 'branchcourse'
    id = Column(Integer, primary_key=True)
    branch = Column(String, nullable=False)
    course = Column(String, nullable=False)
    name = Column(String, nullable=False)
    fetch_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (UniqueConstraint('branch', 'course', name='branchcourse_combo'),)


class CourseGroup(Base):
    __tablename__ = 'coursegroup'
    uid = Column(Integer, primary_key=True)  # Dummy primary key, ORM require primary_key for every table
    course_id = Column(Integer, ForeignKey('branchcourse.id'))
    group = Column(String, nullable=False)
    start = Column(String, nullable=False)  # uitm time inconsistency i should just use string
    end = Column(String, nullable=False)
    day = Column(String, nullable=False)
    mode = Column(String, nullable=False)
    status = Column(String, nullable=False)
    room = Column(String)
    __table_args__ = (UniqueConstraint('course_id', 'group', 'start', 'end', 'day', name='coursegroup_combo'),)


def basic_binding(query) -> str:
    def gen():
        for count in itertools.count(1):
            yield f"${count}"

    placeholder_generator = gen()
    raw_query = str(query.compile(compile_kwargs=dict(literal_binds=True)))
    while True:
        placeholder = "'$'"
        if (index_holder := raw_query.find(placeholder)) != -1:
            to_place = list(raw_query)
            to_place[index_holder: index_holder + len(placeholder)] = next(placeholder_generator)
            raw_query = "".join(to_place)
        else:
            return raw_query
