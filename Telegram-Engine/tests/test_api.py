"""
Integration tests for Telegram-Engine API endpoints.

Covers Telegram and Email scheduling, subscription management, and deletion.
The background scheduler is patched out so no real messages are sent.
"""
import pytest

FUTURE_TIMESTAMP = "2099-01-01T12:00:00"
SENDER_ID = "user-abc"


# ============================================================
# ROOT
# ============================================================

class TestRoot:
    def test_root_returns_200(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        body = resp.json()
        assert body["version"] == "2.0.0"
        assert "telegram" in body["endpoints"]
        assert "email" in body["endpoints"]


# ============================================================
# TELEGRAM: SUBSCRIBE USER
# ============================================================

class TestSubscribeUser:
    def test_subscribe_new_user_returns_200(self, client):
        resp = client.post(
            "/subscribe-user",
            json={"chat_id": "chat_001", "chat_name": "Alice"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["chat_id"] == "chat_001"
        assert data["chat_name"] == "Alice"
        assert "user_id" in data

    def test_subscribe_generates_unique_user_id(self, client):
        r1 = client.post("/subscribe-user", json={"chat_id": "c1", "chat_name": "A"}).json()
        r2 = client.post("/subscribe-user", json={"chat_id": "c2", "chat_name": "B"}).json()
        assert r1["user_id"] != r2["user_id"]

    def test_duplicate_chat_id_returns_400(self, client):
        client.post("/subscribe-user", json={"chat_id": "dup", "chat_name": "First"})
        resp = client.post("/subscribe-user", json={"chat_id": "dup", "chat_name": "Second"})
        assert resp.status_code == 400
        assert "already exists" in resp.json()["detail"]

    def test_get_subscribed_users_lists_all(self, client):
        client.post("/subscribe-user", json={"chat_id": "u1", "chat_name": "U1"})
        client.post("/subscribe-user", json={"chat_id": "u2", "chat_name": "U2"})
        resp = client.get("/subscribed-users")
        assert resp.status_code == 200
        names = [u["chat_name"] for u in resp.json()]
        assert "U1" in names
        assert "U2" in names


# ============================================================
# TELEGRAM: SCHEDULE MESSAGE
# ============================================================

class TestScheduleMessage:
    def test_schedule_message_returns_200(self, client):
        resp = client.post(
            "/schedule-message",
            data={
                "from_sender": SENDER_ID,
                "target_user_id": "user1,user2",
                "message": "Hello team",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Hello team"
        assert data["is_sent"] is False
        assert set(data["target_user_id"]) == {"user1", "user2"}

    def test_schedule_message_generates_unique_id(self, client):
        r1 = client.post(
            "/schedule-message",
            data={
                "from_sender": SENDER_ID,
                "target_user_id": "u1",
                "message": "Msg1",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        ).json()
        r2 = client.post(
            "/schedule-message",
            data={
                "from_sender": SENDER_ID,
                "target_user_id": "u1",
                "message": "Msg2",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        ).json()
        assert r1["id"] != r2["id"]

    def test_invalid_timestamp_returns_400(self, client):
        resp = client.post(
            "/schedule-message",
            data={
                "from_sender": SENDER_ID,
                "target_user_id": "u1",
                "message": "Bad time",
                "scheduled_timestamp": "not-a-date",
            },
        )
        assert resp.status_code == 400
        assert "timestamp" in resp.json()["detail"].lower()

    def test_pending_messages_returns_scheduled(self, client):
        client.post(
            "/schedule-message",
            data={
                "from_sender": SENDER_ID,
                "target_user_id": "u1",
                "message": "Pending msg",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        )
        resp = client.get("/pending-messages", params={"from_sender": SENDER_ID})
        assert resp.status_code == 200
        messages = resp.json()
        assert any(m["message"] == "Pending msg" for m in messages)

    def test_pending_messages_filtered_by_sender(self, client):
        client.post(
            "/schedule-message",
            data={
                "from_sender": "sender_A",
                "target_user_id": "u1",
                "message": "From A",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        )
        client.post(
            "/schedule-message",
            data={
                "from_sender": "sender_B",
                "target_user_id": "u1",
                "message": "From B",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        )
        resp = client.get("/pending-messages", params={"from_sender": "sender_A"})
        messages = resp.json()
        assert all(m["from_sender"] == "sender_A" for m in messages)

    def test_delete_message_returns_true(self, client):
        msg_id = client.post(
            "/schedule-message",
            data={
                "from_sender": SENDER_ID,
                "target_user_id": "u1",
                "message": "To delete",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        ).json()["id"]
        resp = client.delete("/delete-message", params={"message_id": msg_id})
        assert resp.status_code == 200
        assert resp.json() is True

    def test_delete_message_removes_from_pending(self, client):
        msg_id = client.post(
            "/schedule-message",
            data={
                "from_sender": SENDER_ID,
                "target_user_id": "u1",
                "message": "Gone",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        ).json()["id"]
        client.delete("/delete-message", params={"message_id": msg_id})
        resp = client.get("/pending-messages", params={"from_sender": SENDER_ID})
        ids = [m["id"] for m in resp.json()]
        assert msg_id not in ids

    def test_delete_nonexistent_message_returns_404(self, client):
        resp = client.delete("/delete-message", params={"message_id": "no-such-id"})
        assert resp.status_code == 404


# ============================================================
# EMAIL: SUBSCRIBE EMAIL USER
# ============================================================

class TestSubscribeEmailUser:
    def test_subscribe_email_user_returns_200(self, client):
        resp = client.post(
            "/subscribe-email-user",
            json={"email_address": "alice@example.com", "user_name": "Alice"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["email_address"] == "alice@example.com"
        assert data["user_name"] == "Alice"
        assert "user_id" in data

    def test_duplicate_email_returns_400(self, client):
        client.post("/subscribe-email-user", json={"email_address": "dup@x.com", "user_name": "First"})
        resp = client.post("/subscribe-email-user", json={"email_address": "dup@x.com", "user_name": "Second"})
        assert resp.status_code == 400

    def test_get_subscribed_email_users_lists_all(self, client):
        client.post("/subscribe-email-user", json={"email_address": "a@x.com", "user_name": "A"})
        client.post("/subscribe-email-user", json={"email_address": "b@x.com", "user_name": "B"})
        resp = client.get("/subscribed-email-users")
        assert resp.status_code == 200
        emails = [u["email_address"] for u in resp.json()]
        assert "a@x.com" in emails
        assert "b@x.com" in emails


# ============================================================
# EMAIL: SCHEDULE EMAIL
# ============================================================

class TestScheduleEmail:
    def test_schedule_email_returns_200(self, client):
        resp = client.post(
            "/schedule-email",
            data={
                "from_sender": SENDER_ID,
                "target_user_id": "user1,user2",
                "subject": "Team Update",
                "message": "Hello everyone",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["subject"] == "Team Update"
        assert data["message"] == "Hello everyone"
        assert data["is_sent"] is False
        assert set(data["target_user_id"]) == {"user1", "user2"}

    def test_schedule_email_invalid_timestamp_returns_400(self, client):
        resp = client.post(
            "/schedule-email",
            data={
                "from_sender": SENDER_ID,
                "target_user_id": "u1",
                "subject": "Subj",
                "message": "Body",
                "scheduled_timestamp": "bad-date",
            },
        )
        assert resp.status_code == 400

    def test_pending_emails_returns_scheduled(self, client):
        client.post(
            "/schedule-email",
            data={
                "from_sender": SENDER_ID,
                "target_user_id": "u1",
                "subject": "S",
                "message": "Pending email",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        )
        resp = client.get("/pending-emails", params={"from_sender": SENDER_ID})
        assert resp.status_code == 200
        assert any(e["message"] == "Pending email" for e in resp.json())

    def test_pending_emails_filtered_by_sender(self, client):
        client.post(
            "/schedule-email",
            data={
                "from_sender": "A",
                "target_user_id": "u1",
                "subject": "SA",
                "message": "From A",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        )
        client.post(
            "/schedule-email",
            data={
                "from_sender": "B",
                "target_user_id": "u1",
                "subject": "SB",
                "message": "From B",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        )
        resp = client.get("/pending-emails", params={"from_sender": "A"})
        assert all(e["from_sender"] == "A" for e in resp.json())

    def test_delete_email_returns_true(self, client):
        email_id = client.post(
            "/schedule-email",
            data={
                "from_sender": SENDER_ID,
                "target_user_id": "u1",
                "subject": "S",
                "message": "Del",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        ).json()["id"]
        resp = client.delete("/delete-email", params={"email_id": email_id})
        assert resp.status_code == 200
        assert resp.json() is True

    def test_delete_email_removes_from_pending(self, client):
        email_id = client.post(
            "/schedule-email",
            data={
                "from_sender": SENDER_ID,
                "target_user_id": "u1",
                "subject": "S",
                "message": "Gone",
                "scheduled_timestamp": FUTURE_TIMESTAMP,
            },
        ).json()["id"]
        client.delete("/delete-email", params={"email_id": email_id})
        resp = client.get("/pending-emails", params={"from_sender": SENDER_ID})
        ids = [e["id"] for e in resp.json()]
        assert email_id not in ids

    def test_delete_nonexistent_email_returns_404(self, client):
        resp = client.delete("/delete-email", params={"email_id": "no-such-id"})
        assert resp.status_code == 404
