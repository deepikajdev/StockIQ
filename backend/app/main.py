from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import Base, engine
from .routers import auth, inventory, products, purchases, sales, suppliers


@asynccontextmanager
async def lifespan(app: FastAPI):
    from . import models  # noqa: F401  (register tables)
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="StockIQ API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

for r in (auth.router, products.router, suppliers.router, purchases.router, sales.router, inventory.router):
    app.include_router(r)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
