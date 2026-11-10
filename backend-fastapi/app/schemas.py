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

class ReadingIn(BaseModel):
    recorded_at: datetime
    occupied: bool
    temperature_c: float = Field(ge=-20, le=60)
    humidity: float = Field(ge=0, le=100)
    light_level: int = Field(ge=0, le=1023)

class ReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    bed_id: str
    recorded_at: datetime
    occupied: bool
    temperature_c: float
    humidity: float
    light_level: int
    heating_led_on: bool
    light_warning: bool


