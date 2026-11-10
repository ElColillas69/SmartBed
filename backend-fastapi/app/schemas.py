from pydantic import BaseModel, ConfigDict, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1, max_length=80)

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True) # reads SQLAlchemy objs instead of needing to directly translate it from dict
    id: str
    email: EmailStr
    display_name: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

