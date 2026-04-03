from contextlib import asynccontextmanager
from pathlib import Path

import logging
import sqlite3

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env")

from pydantic import BaseModel, field_validator

from app import db
from app.debug_agent_log import agent_log
from app.meals import daily_summary, log_meal


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.get_connection()
    yield


app = FastAPI(title="Hybrid Calorie App", lifespan=lifespan)


@app.middleware("http")
async def expose_unhandled_errors(request: Request, call_next):
    """Return JSON {detail: ...} for bugs instead of a blank 500 (helps UI + debug)."""
    try:
        return await call_next(request)
    except HTTPException:
        raise
    except (RequestValidationError, ResponseValidationError):
        raise
    except Exception as e:
        logging.getLogger("app.main").exception("Unhandled request error")
        return JSONResponse(
            status_code=500,
            content={"detail": f"{type(e).__name__}: {str(e)}"},
        )


@app.get("/")
async def root() -> dict[str, str]:
    """API-only server: there is no HTML app on this port. Use the Vite dev server for the UI."""
    return {
        "service": "Hybrid Calorie App API",
        "docs": "/docs",
        "log_meal": "POST /log-meal",
        "daily_summary": "GET /get-daily-summary?date=YYYY-MM-DD",
    }


app.add_middleware(
    CORSMiddleware,
    # IPv6 loopback ([::1]) is common when the dev server is opened as localhost.
    allow_origin_regex=r"http://(\[::1\]|127\.0\.0\.1|localhost)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LogMealBody(BaseModel):
    text: str
    date: str

    @field_validator("text")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return v.strip()


@app.post("/log-meal")
async def post_log_meal(body: LogMealBody) -> dict:
    # region agent log
    agent_log(
        "main.py:post_log_meal",
        "entry",
        {"text_len": len(body.text), "date": body.date},
        "H1",
    )
    # endregion
    if not body.text:
        raise HTTPException(status_code=400, detail="text is required")
    try:
        return await log_meal(body.text, body.date)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except sqlite3.IntegrityError as e:
        raise HTTPException(status_code=502, detail=f"Database constraint: {e}") from e
    except TypeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        # region agent log
        agent_log(
            "main.py:post_log_meal",
            "unhandled_exception",
            {"exc_type": type(e).__name__, "exc_msg": str(e)[:500]},
            "H1",
        )
        # endregion
        raise


@app.get("/get-daily-summary")
async def get_daily_summary(date: str) -> dict:
    return daily_summary(date)
