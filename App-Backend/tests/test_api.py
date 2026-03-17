"""
Integration tests for App-Backend API endpoints.

Each test uses the in-memory DB TestClient from conftest.py and exercises
the full request/response cycle through FastAPI.
"""
import pytest
from conftest import USER_UUID, register_and_get_uuid


# ============================================================
# AUTH ENDPOINTS
# ============================================================

class TestRegister:
    def test_register_new_user_returns_201(self, client):
        resp = client.post("/register", json={"username": "newuser", "password": "pass123"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["username"] == "newuser"
        assert "uuid" in data

    def test_register_duplicate_username_returns_400(self, client):
        client.post("/register", json={"username": "dup", "password": "pass"})
        resp = client.post("/register", json={"username": "dup", "password": "pass"})
        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"].lower()

    def test_register_response_does_not_expose_password(self, client):
        resp = client.post("/register", json={"username": "safe", "password": "secret"})
        assert "password" not in resp.json()
        assert "hashed_password" not in resp.json()


class TestSignIn:
    def test_valid_credentials_returns_200(self, client):
        client.post("/register", json={"username": "loginuser", "password": "correct"})
        resp = client.post("/sign-in", json={"username": "loginuser", "password": "correct"})
        assert resp.status_code == 200
        assert resp.json()["username"] == "loginuser"

    def test_wrong_password_returns_401(self, client):
        client.post("/register", json={"username": "user2", "password": "right"})
        resp = client.post("/sign-in", json={"username": "user2", "password": "wrong"})
        assert resp.status_code == 401

    def test_unknown_user_returns_401(self, client):
        resp = client.post("/sign-in", json={"username": "ghost", "password": "pass"})
        assert resp.status_code == 401


# ============================================================
# WORKSPACE ENDPOINTS
# ============================================================

class TestWorkspaces:
    def _user_uuid(self, client) -> str:
        return register_and_get_uuid(client)

    def test_create_workspace_returns_201(self, client):
        uuid = self._user_uuid(client)
        resp = client.post(
            "/workspaces",
            json={"name": "My Project", "description": "desc", "color": "#ff0000"},
            params={"user_uuid": uuid},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Project"
        assert data["color"] == "#ff0000"
        assert data["owner_uuid"] == uuid

    def test_create_workspace_defaults_color(self, client):
        uuid = self._user_uuid(client)
        resp = client.post("/workspaces", json={"name": "No Color"}, params={"user_uuid": uuid})
        assert resp.status_code == 201
        assert resp.json()["color"] == "#14b8a6"

    def test_list_workspaces_returns_only_own(self, client):
        uuid = self._user_uuid(client)
        client.post("/workspaces", json={"name": "WS1"}, params={"user_uuid": uuid})
        client.post("/workspaces", json={"name": "WS2"}, params={"user_uuid": uuid})
        # Register a second user whose workspaces should not appear
        client.post("/register", json={"username": "other", "password": "p"})
        other_uuid = client.post("/sign-in", json={"username": "other", "password": "p"}).json()["uuid"]
        client.post("/workspaces", json={"name": "OtherWS"}, params={"user_uuid": other_uuid})

        resp = client.get("/workspaces", params={"user_uuid": uuid})
        assert resp.status_code == 200
        names = [w["name"] for w in resp.json()]
        assert "WS1" in names
        assert "WS2" in names
        assert "OtherWS" not in names

    def test_get_workspace_by_id(self, client):
        uuid = self._user_uuid(client)
        create_resp = client.post("/workspaces", json={"name": "FindMe"}, params={"user_uuid": uuid})
        ws_id = create_resp.json()["id"]
        resp = client.get(f"/workspaces/{ws_id}", params={"user_uuid": uuid})
        assert resp.status_code == 200
        assert resp.json()["name"] == "FindMe"

    def test_get_workspace_not_found_returns_404(self, client):
        uuid = self._user_uuid(client)
        resp = client.get("/workspaces/nonexistent", params={"user_uuid": uuid})
        assert resp.status_code == 404

    def test_update_workspace(self, client):
        uuid = self._user_uuid(client)
        ws_id = client.post("/workspaces", json={"name": "Old"}, params={"user_uuid": uuid}).json()["id"]
        resp = client.put(f"/workspaces/{ws_id}", json={"name": "New"}, params={"user_uuid": uuid})
        assert resp.status_code == 200
        assert resp.json()["name"] == "New"

    def test_delete_workspace_returns_deleted_true(self, client):
        uuid = self._user_uuid(client)
        ws_id = client.post("/workspaces", json={"name": "ToDelete"}, params={"user_uuid": uuid}).json()["id"]
        resp = client.delete(f"/workspaces/{ws_id}", params={"user_uuid": uuid})
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    def test_delete_workspace_unlinks_projects(self, client):
        uuid = self._user_uuid(client)
        ws_id = client.post("/workspaces", json={"name": "WS"}, params={"user_uuid": uuid}).json()["id"]
        proj_id = client.post(
            "/projects",
            json={"name": "LinkedProj", "workspace_id": ws_id},
            params={"user_uuid": uuid},
        ).json()["id"]
        # Delete the workspace
        client.delete(f"/workspaces/{ws_id}", params={"user_uuid": uuid})
        # The project should still exist but with workspace_id=None
        proj = client.get(f"/projects/{proj_id}", params={"user_uuid": uuid}).json()
        assert proj["workspace_id"] is None


# ============================================================
# PROJECT ENDPOINTS
# ============================================================

class TestProjects:
    def _user_uuid(self, client) -> str:
        return register_and_get_uuid(client)

    def test_create_project_returns_201(self, client):
        uuid = self._user_uuid(client)
        resp = client.post("/projects", json={"name": "Task Alpha"}, params={"user_uuid": uuid})
        assert resp.status_code == 201
        assert resp.json()["name"] == "Task Alpha"

    def test_list_projects_filters_by_workspace(self, client):
        uuid = self._user_uuid(client)
        ws_id = client.post("/workspaces", json={"name": "WS"}, params={"user_uuid": uuid}).json()["id"]
        client.post("/projects", json={"name": "InWS", "workspace_id": ws_id}, params={"user_uuid": uuid})
        client.post("/projects", json={"name": "Standalone"}, params={"user_uuid": uuid})

        resp = client.get("/projects", params={"user_uuid": uuid, "workspace_id": ws_id})
        names = [p["name"] for p in resp.json()]
        assert "InWS" in names
        assert "Standalone" not in names

    def test_update_project_color(self, client):
        uuid = self._user_uuid(client)
        proj_id = client.post("/projects", json={"name": "P"}, params={"user_uuid": uuid}).json()["id"]
        resp = client.put(f"/projects/{proj_id}", json={"color": "#123456"}, params={"user_uuid": uuid})
        assert resp.json()["color"] == "#123456"

    def test_delete_project(self, client):
        uuid = self._user_uuid(client)
        proj_id = client.post("/projects", json={"name": "Del"}, params={"user_uuid": uuid}).json()["id"]
        client.delete(f"/projects/{proj_id}", params={"user_uuid": uuid})
        resp = client.get(f"/projects/{proj_id}", params={"user_uuid": uuid})
        assert resp.status_code == 404


# ============================================================
# TEAM MEMBER ENDPOINTS
# ============================================================

class TestTeamMembers:
    def _user_uuid(self, client) -> str:
        return register_and_get_uuid(client)

    def test_create_team_member_returns_201(self, client):
        uuid = self._user_uuid(client)
        resp = client.post(
            "/team-members",
            json={"name": "Alice Smith", "role": "Developer"},
            params={"user_uuid": uuid},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Alice Smith"
        assert data["role"] == "Developer"

    def test_avatar_initials_auto_generated_from_name(self, client):
        uuid = self._user_uuid(client)
        resp = client.post(
            "/team-members",
            json={"name": "John Doe"},
            params={"user_uuid": uuid},
        )
        assert resp.json()["avatar_initials"] == "JD"

    def test_avatar_initials_single_name(self, client):
        uuid = self._user_uuid(client)
        resp = client.post(
            "/team-members",
            json={"name": "Madonna"},
            params={"user_uuid": uuid},
        )
        assert resp.json()["avatar_initials"] == "M"

    def test_avatar_initials_custom_value_respected(self, client):
        uuid = self._user_uuid(client)
        resp = client.post(
            "/team-members",
            json={"name": "John Doe", "avatar_initials": "XX"},
            params={"user_uuid": uuid},
        )
        assert resp.json()["avatar_initials"] == "XX"

    def test_default_weekly_capacity_is_40(self, client):
        uuid = self._user_uuid(client)
        resp = client.post("/team-members", json={"name": "Eve"}, params={"user_uuid": uuid})
        assert resp.json()["weekly_capacity_hours"] == 40

    def test_list_team_members(self, client):
        uuid = self._user_uuid(client)
        client.post("/team-members", json={"name": "M1"}, params={"user_uuid": uuid})
        client.post("/team-members", json={"name": "M2"}, params={"user_uuid": uuid})
        resp = client.get("/team-members", params={"user_uuid": uuid})
        assert len(resp.json()) == 2

    def test_update_team_member_email(self, client):
        uuid = self._user_uuid(client)
        member_id = client.post(
            "/team-members", json={"name": "Test"}, params={"user_uuid": uuid}
        ).json()["id"]
        resp = client.put(
            f"/team-members/{member_id}",
            json={"email": "test@example.com"},
            params={"user_uuid": uuid},
        )
        assert resp.json()["email"] == "test@example.com"

    def test_delete_team_member(self, client):
        uuid = self._user_uuid(client)
        member_id = client.post(
            "/team-members", json={"name": "ToRemove"}, params={"user_uuid": uuid}
        ).json()["id"]
        client.delete(f"/team-members/{member_id}", params={"user_uuid": uuid})
        resp = client.get(f"/team-members/{member_id}", params={"user_uuid": uuid})
        assert resp.status_code == 404


# ============================================================
# TIMELINE TASK ENDPOINTS
# ============================================================

class TestTimelineTasks:
    def _setup(self, client):
        """Returns (user_uuid, project_id)."""
        uuid = register_and_get_uuid(client)
        proj_id = client.post(
            "/projects", json={"name": "Proj"}, params={"user_uuid": uuid}
        ).json()["id"]
        return uuid, proj_id

    def test_create_timeline_task_returns_201(self, client):
        uuid, proj_id = self._setup(client)
        resp = client.post(
            "/timeline-tasks",
            json={
                "title": "Build feature",
                "project_id": proj_id,
                "start_date": "2026-04-01",
                "end_date": "2026-04-15",
            },
            params={"user_uuid": uuid},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Build feature"
        assert data["status"] == "planned"
        assert data["hours_per_week"] == 8

    def test_list_tasks_filters_by_project(self, client):
        uuid, proj_id = self._setup(client)
        other_proj_id = client.post(
            "/projects", json={"name": "Other"}, params={"user_uuid": uuid}
        ).json()["id"]
        client.post(
            "/timeline-tasks",
            json={"title": "T1", "project_id": proj_id, "start_date": "2026-04-01", "end_date": "2026-04-10"},
            params={"user_uuid": uuid},
        )
        client.post(
            "/timeline-tasks",
            json={"title": "T2", "project_id": other_proj_id, "start_date": "2026-04-01", "end_date": "2026-04-10"},
            params={"user_uuid": uuid},
        )
        resp = client.get("/timeline-tasks", params={"user_uuid": uuid, "project_id": proj_id})
        titles = [t["title"] for t in resp.json()]
        assert "T1" in titles
        assert "T2" not in titles

    def test_update_task_status(self, client):
        uuid, proj_id = self._setup(client)
        task_id = client.post(
            "/timeline-tasks",
            json={"title": "T", "project_id": proj_id, "start_date": "2026-04-01", "end_date": "2026-04-05"},
            params={"user_uuid": uuid},
        ).json()["id"]
        resp = client.put(
            f"/timeline-tasks/{task_id}",
            json={"status": "completed"},
            params={"user_uuid": uuid},
        )
        assert resp.json()["status"] == "completed"

    def test_delete_timeline_task(self, client):
        uuid, proj_id = self._setup(client)
        task_id = client.post(
            "/timeline-tasks",
            json={"title": "Del", "project_id": proj_id, "start_date": "2026-04-01", "end_date": "2026-04-05"},
            params={"user_uuid": uuid},
        ).json()["id"]
        client.delete(f"/timeline-tasks/{task_id}", params={"user_uuid": uuid})
        resp = client.get(f"/timeline-tasks/{task_id}", params={"user_uuid": uuid})
        assert resp.status_code == 404

    def test_get_task_not_found_returns_404(self, client):
        uuid, _ = self._setup(client)
        resp = client.get("/timeline-tasks/doesnotexist", params={"user_uuid": uuid})
        assert resp.status_code == 404


# ============================================================
# ROOT
# ============================================================

class TestRoot:
    def test_root_returns_200(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "version" in resp.json()
