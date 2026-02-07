from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class User(BaseModel):
    username: str
    uuid: str


    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    username: str
    password: str

class UserSignIn(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str


# --- Workspace Schemas (User-facing: "Course") ---

class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#14b8a6"

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: str
    color: str
    owner_uuid: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Project Schemas (User-facing: "Unit") ---

class ProjectCreate(BaseModel):
    name: str
    color: Optional[str] = "#14b8a6"
    workspace_id: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    workspace_id: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    color: str
    workspace_id: Optional[str] = None
    owner_uuid: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- TeamMember Schemas (User-facing: "Student") ---

class TeamMemberCreate(BaseModel):
    name: str
    role: Optional[str] = ""
    avatar_initials: Optional[str] = None
    weekly_capacity_hours: Optional[int] = 25

class TeamMemberUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    avatar_initials: Optional[str] = None
    weekly_capacity_hours: Optional[int] = None

class TeamMemberResponse(BaseModel):
    id: str
    name: str
    role: str
    avatar_initials: str
    weekly_capacity_hours: int
    owner_uuid: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- TimelineTask Schemas (User-facing: "Lesson") ---

class TimelineTaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    project_id: str
    assignee_id: Optional[str] = None
    start_date: str
    end_date: str
    hours_per_week: Optional[int] = 8
    status: Optional[str] = "planned"

class TimelineTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[str] = None
    assignee_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    hours_per_week: Optional[int] = None
    status: Optional[str] = None

class TimelineTaskResponse(BaseModel):
    id: str
    title: str
    description: str
    project_id: str
    assignee_id: Optional[str] = None
    start_date: str
    end_date: str
    hours_per_week: int
    status: str
    owner_uuid: str
    created_at: datetime

    class Config:
        from_attributes = True
