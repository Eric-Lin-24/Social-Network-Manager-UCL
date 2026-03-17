"""
FastAPI application - REST API endpoints for scheduled message system.
"""
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid
import os
from dotenv import load_dotenv
import shutil
from pathlib import Path

from database import get_db, init_db, get_user_by_username
from models import Workspace, Project, TeamMember, TimelineTask
from schemas import (
    User,
    UserCreate,
    UserSignIn,
    WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse,
    ProjectCreate, ProjectUpdate, ProjectResponse,
    TeamMemberCreate, TeamMemberUpdate, TeamMemberResponse,
    TimelineTaskCreate, TimelineTaskUpdate, TimelineTaskResponse,
)

from auth import create_user, verify_password

# Load environment variables
load_dotenv()

# Create FastAPI application
app = FastAPI(
    title="Scheduled Message API",
    description="API for scheduling messages with file attachments and Telegram delivery",
    version="1.0.0"
)


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base URL for file access
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")


@app.on_event("startup")
async def startup_event():
    """Initialize database and start background tasks on startup"""
    init_db()


@app.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return create_user(db=db, user=user)

@app.post("/sign-in", response_model=User)
def sign_in(user: UserSignIn, db: Session = Depends(get_db)):
    db_user = get_user_by_username(db, username=user.username)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return db_user

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Scheduled Message API",
        "version": "1.0.0",
        "endpoints": {
            "POST /schedule-message": "Schedule a new message",
            "POST /subscribe-user": "Subscribe a new user",
            "GET /pending-messages": "Get all pending messages",
            "GET /subscribed-users": "Get all subscribed users"
        },
        "docs": "/docs",
        "redoc": "/redoc"
    }


# ============================================
# WORKSPACE ENDPOINTS (User-facing: "Project")
# ============================================

@app.post("/workspaces", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(ws: WorkspaceCreate, user_uuid: str, db: Session = Depends(get_db)):
    db_ws = Workspace(
        id=str(uuid.uuid4()),
        name=ws.name,
        description=ws.description or "",
        color=ws.color or "#14b8a6",
        owner_uuid=user_uuid,
    )
    db.add(db_ws)
    db.commit()
    db.refresh(db_ws)
    return db_ws


@app.get("/workspaces", response_model=List[WorkspaceResponse])
def list_workspaces(user_uuid: str, db: Session = Depends(get_db)):
    return db.query(Workspace).filter(Workspace.owner_uuid == user_uuid).all()


@app.get("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(workspace_id: str, user_uuid: str, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.owner_uuid == user_uuid).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


@app.put("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(workspace_id: str, ws: WorkspaceUpdate, user_uuid: str, db: Session = Depends(get_db)):
    db_ws = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.owner_uuid == user_uuid).first()
    if not db_ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    for field, value in ws.dict(exclude_unset=True).items():
        setattr(db_ws, field, value)
    db.commit()
    db.refresh(db_ws)
    return db_ws


@app.delete("/workspaces/{workspace_id}")
def delete_workspace(workspace_id: str, user_uuid: str, db: Session = Depends(get_db)):
    db_ws = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.owner_uuid == user_uuid).first()
    if not db_ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    # Cascade: unlink projects (set workspace_id to None)
    db.query(Project).filter(Project.workspace_id == workspace_id, Project.owner_uuid == user_uuid).update({"workspace_id": None})
    db.delete(db_ws)
    db.commit()
    return {"deleted": True}


# ============================================
# PROJECT ENDPOINTS (User-facing: "Task")
# ============================================

@app.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(project: ProjectCreate, user_uuid: str, db: Session = Depends(get_db)):
    db_project = Project(
        id=str(uuid.uuid4()),
        name=project.name,
        color=project.color or "#14b8a6",
        workspace_id=project.workspace_id,
        owner_uuid=user_uuid,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@app.get("/projects", response_model=List[ProjectResponse])
def list_projects(user_uuid: str, workspace_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Project).filter(Project.owner_uuid == user_uuid)
    if workspace_id:
        query = query.filter(Project.workspace_id == workspace_id)
    return query.all()


@app.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, user_uuid: str, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == project_id, Project.owner_uuid == user_uuid).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


@app.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, project: ProjectUpdate, user_uuid: str, db: Session = Depends(get_db)):
    db_proj = db.query(Project).filter(Project.id == project_id, Project.owner_uuid == user_uuid).first()
    if not db_proj:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in project.dict(exclude_unset=True).items():
        setattr(db_proj, field, value)
    db.commit()
    db.refresh(db_proj)
    return db_proj


@app.delete("/projects/{project_id}")
def delete_project(project_id: str, user_uuid: str, db: Session = Depends(get_db)):
    db_proj = db.query(Project).filter(Project.id == project_id, Project.owner_uuid == user_uuid).first()
    if not db_proj:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(db_proj)
    db.commit()
    return {"deleted": True}


# ============================================
# TEAM MEMBER ENDPOINTS
# ============================================

@app.post("/team-members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
def create_team_member(member: TeamMemberCreate, user_uuid: str, db: Session = Depends(get_db)):
    initials = member.avatar_initials
    if not initials:
        parts = member.name.strip().split()
        initials = (parts[0][0] + (parts[-1][0] if len(parts) > 1 else "")).upper()
    db_member = TeamMember(
        id=str(uuid.uuid4()),
        name=member.name,
        role=member.role or "",
        avatar_initials=initials,
        weekly_capacity_hours=member.weekly_capacity_hours or 40,
        email=member.email or "",
        phone=member.phone or "",
        owner_uuid=user_uuid,
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member


@app.get("/team-members", response_model=List[TeamMemberResponse])
def list_team_members(user_uuid: str, db: Session = Depends(get_db)):
    return db.query(TeamMember).filter(TeamMember.owner_uuid == user_uuid).all()


@app.get("/team-members/{member_id}", response_model=TeamMemberResponse)
def get_team_member(member_id: str, user_uuid: str, db: Session = Depends(get_db)):
    m = db.query(TeamMember).filter(TeamMember.id == member_id, TeamMember.owner_uuid == user_uuid).first()
    if not m:
        raise HTTPException(status_code=404, detail="Team member not found")
    return m


@app.put("/team-members/{member_id}", response_model=TeamMemberResponse)
def update_team_member(member_id: str, member: TeamMemberUpdate, user_uuid: str, db: Session = Depends(get_db)):
    db_m = db.query(TeamMember).filter(TeamMember.id == member_id, TeamMember.owner_uuid == user_uuid).first()
    if not db_m:
        raise HTTPException(status_code=404, detail="Team member not found")
    for field, value in member.dict(exclude_unset=True).items():
        setattr(db_m, field, value)
    db.commit()
    db.refresh(db_m)
    return db_m


@app.delete("/team-members/{member_id}")
def delete_team_member(member_id: str, user_uuid: str, db: Session = Depends(get_db)):
    db_m = db.query(TeamMember).filter(TeamMember.id == member_id, TeamMember.owner_uuid == user_uuid).first()
    if not db_m:
        raise HTTPException(status_code=404, detail="Team member not found")
    db.delete(db_m)
    db.commit()
    return {"deleted": True}


# ============================================
# TIMELINE TASK ENDPOINTS
# ============================================

@app.post("/timeline-tasks", response_model=TimelineTaskResponse, status_code=status.HTTP_201_CREATED)
def create_timeline_task(task: TimelineTaskCreate, user_uuid: str, db: Session = Depends(get_db)):
    db_task = TimelineTask(
        id=str(uuid.uuid4()),
        title=task.title,
        description=task.description or "",
        project_id=task.project_id,
        assignee_id=task.assignee_id,
        start_date=task.start_date,
        end_date=task.end_date,
        hours_per_week=task.hours_per_week or 8,
        status=task.status or "planned",
        owner_uuid=user_uuid,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@app.get("/timeline-tasks", response_model=List[TimelineTaskResponse])
def list_timeline_tasks(
    user_uuid: str,
    project_id: Optional[str] = None,
    assignee_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(TimelineTask).filter(TimelineTask.owner_uuid == user_uuid)
    if project_id:
        query = query.filter(TimelineTask.project_id == project_id)
    if assignee_id:
        query = query.filter(TimelineTask.assignee_id == assignee_id)
    return query.all()


@app.get("/timeline-tasks/{task_id}", response_model=TimelineTaskResponse)
def get_timeline_task(task_id: str, user_uuid: str, db: Session = Depends(get_db)):
    t = db.query(TimelineTask).filter(TimelineTask.id == task_id, TimelineTask.owner_uuid == user_uuid).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return t


@app.put("/timeline-tasks/{task_id}", response_model=TimelineTaskResponse)
def update_timeline_task(task_id: str, task: TimelineTaskUpdate, user_uuid: str, db: Session = Depends(get_db)):
    db_task = db.query(TimelineTask).filter(TimelineTask.id == task_id, TimelineTask.owner_uuid == user_uuid).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in task.dict(exclude_unset=True).items():
        setattr(db_task, field, value)
    db.commit()
    db.refresh(db_task)
    return db_task


@app.delete("/timeline-tasks/{task_id}")
def delete_timeline_task_api(task_id: str, user_uuid: str, db: Session = Depends(get_db)):
    db_task = db.query(TimelineTask).filter(TimelineTask.id == task_id, TimelineTask.owner_uuid == user_uuid).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(db_task)
    db.commit()
    return {"deleted": True}


def create_app():
    """Factory function to create and configure the FastAPI application"""
    return app
