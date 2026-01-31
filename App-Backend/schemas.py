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
