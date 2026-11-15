from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr
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

    data_mode: Literal["static", "api"] = "static"
    earthdata_token: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("SURFACESIGNAL_EARTHDATA_TOKEN", "EARTHDATA_TOKEN"),
    )
    ana_api_token: SecretStr | None = Field(
        default=None, validation_alias=AliasChoices("SURFACESIGNAL_ANA_API_TOKEN", "ANA_API_TOKEN")
    )
    snapshot_manifest: str | None = None

    @classmethod
    def from_root(cls, root=None):
        if root is not None:
            root = Path(root).resolve()
            return cls(root=root, _env_file=root / ".env")
        return cls()

    @property
    def areas_dir(self):
        return self.root / "config" / "areas"

    @property
    def catalog_dir(self):
        return self.root / "data" / "catalog"

    @property
    def artifacts_dir(self):
        return self.root / "artifacts"
