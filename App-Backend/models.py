from sqlalchemy import Column, String, DateTime, Boolean, JSON, Integer
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    uuid = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, default="#14b8a6")
    owner_uuid = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, default="")
    avatar_initials = Column(String, default="??")
    weekly_capacity_hours = Column(Integer, default=40)
    owner_uuid = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TimelineTask(Base):
    __tablename__ = "timeline_tasks"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, default="")
    project_id = Column(String, index=True)
    assignee_id = Column(String, index=True)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    hours_per_week = Column(Integer, default=8)
    status = Column(String, default="planned")
    owner_uuid = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
