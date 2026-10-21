from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
import secrets


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, default="")
    password_hash = Column(String, nullable=True)   # Google se aaye user ka khali rahega
    google_id = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EmailCode(Base):
    """Email verification code (signup) aur forgot-password code yahan temporary rakhe jaate hain."""
    __tablename__ = "email_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    purpose = Column(String, nullable=False, default="reset")   # "signup" ya "reset"
    code_hash = Column(String, nullable=False)                  # code seedha save nahi hota, sirf hash
    name = Column(String, nullable=True)                        # signup ke time ka naam
    password_hash = Column(String, nullable=True)               # signup ke time ka password (hash)
    verified = Column(Boolean, default=False)
    reset_token_hash = Column(String, nullable=True)
    attempts = Column(Integer, default=0)
    last_sent_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Provider(Base):
    __tablename__ = "providers"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String, nullable=False, index=True, default="")
    name = Column(String, nullable=False)
    api_key = Column(String, nullable=False)
    base_url = Column(String, default="https://api.openai.com/v1")
    model_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProductKey(Base):
    __tablename__ = "product_keys"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String, nullable=False, index=True, default="")
    key = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, default="Company Product")
    company_name = Column(String, default="")

    low_provider_id = Column(Integer, ForeignKey("providers.id"), nullable=True)
    medium_provider_id = Column(Integer, ForeignKey("providers.id"), nullable=True)
    hard_provider_id = Column(Integer, ForeignKey("providers.id"), nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    low_provider = relationship("Provider", foreign_keys=[low_provider_id])
    medium_provider = relationship("Provider", foreign_keys=[medium_provider_id])
    hard_provider = relationship("Provider", foreign_keys=[hard_provider_id])

    @staticmethod
    def generate_key():
        return "pk_" + secrets.token_urlsafe(32)


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String, nullable=False, index=True, default="")
    provider_id = Column(Integer, ForeignKey("providers.id"), nullable=True, index=True)
    product_key_id = Column(Integer, ForeignKey("product_keys.id"), nullable=True, index=True)
    provider_name = Column(String, default="")
    model_name = Column(String, default="")
    complexity = Column(String, default="low")
    success = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)