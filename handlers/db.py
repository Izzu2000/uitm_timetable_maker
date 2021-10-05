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
    course_id = Column(Integer, ForeignKey('branchcourse.id'), primary_key=True)
    groups = Column(String, nullable=False)
    starts = Column(String, nullable=False)  # uitm time inconsistency i should just use string
    ends = Column(String, nullable=False)
    day = Column(String, nullable=False)
    mode = Column(String, nullable=False)
    status = Column(String, nullable=False)
    room = Column(String)
