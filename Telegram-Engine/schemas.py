from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ScheduleMessageRequest(BaseModel):
    target_user_id: List[str]
    message: str
    scheduled_timestamp: str  # UTC timestamp string

class ScheduleMessageResponse(BaseModel):
    id: str
    from_sender: str
    target_user_id: List[str]
    message: str
    scheduled_timestamp: datetime
    file_paths: Optional[List[str]] = None
    is_sent: bool
    created_at: datetime

    class Config:
        from_attributes = True

class SubscribeUserRequest(BaseModel):
    chat_id: str
    chat_name: str

class SubscribeUserResponse(BaseModel):
    user_id: str
    chat_id: str
    chat_name: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
