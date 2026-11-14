from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SURFACESIGNAL_",
        env_file=(REPOSITORY_ROOT / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )
    root: Path = REPOSITORY_ROOT
    cors_origins: list[str] = []

    @property
    def areas_dir(self):
        return self.root / "config" / "areas"

    @property
    def catalog_dir(self):
        return self.root / "data" / "catalog"

    @property
    def artifacts_dir(self):
        return self.root / "artifacts"
