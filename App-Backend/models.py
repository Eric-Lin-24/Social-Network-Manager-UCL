from sqlalchemy import Column, String, DateTime, Boolean, JSON, Integer, Text
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


class Workspace(Base):
    """Top-level Course that groups Units together.
    User-facing name: 'Course'  (Course > Unit > Lesson)"""
    __tablename__ = "workspaces"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    color = Column(String, default="#14b8a6")
    owner_uuid = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Project(Base):
    """Mid-level Unit that belongs to a Course.
    User-facing name: 'Unit'  (Course > Unit > Lesson)"""
    __tablename__ = "projects"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, default="#14b8a6")
    workspace_id = Column(String, index=True, nullable=True)  # FK to workspaces.id
    owner_uuid = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, default="")
    avatar_initials = Column(String, default="??")
    weekly_capacity_hours = Column(Integer, default=25)
    owner_uuid = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TimelineTask(Base):
    __tablename__ = "timeline_tasks"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, default="")
    project_id = Column(String, index=True)
    assignee_id = Column(String, index=True, nullable=True)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    hours_per_week = Column(Integer, default=8)
    status = Column(String, default="planned")
    owner_uuid = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
