from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1, max_length=80)
    role: Literal["resident", "caretaker"]

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True) # reads SQLAlchemy objs
    id: str
    email: EmailStr
    display_name: str
    role: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

