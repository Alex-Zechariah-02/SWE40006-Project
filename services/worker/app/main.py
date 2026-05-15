import asyncio
import signal

from fastapi import FastAPI
from bullmq import Worker

from .queue_proof import process_queue_proof
from .extraction_worker import process_extraction
from . import settings


app = FastAPI(title="Balance Worker", version="0.1.0")

_shutdown = asyncio.Event()
_workers: list[Worker] = []


@app.get("/health")
async def health():
    return {"status": "ok", "service": "balance-worker"}


@app.get("/ready")
async def ready():
    # For now, readiness is "worker process is alive".
    return {"status": "ready", "service": "balance-worker"}


@app.on_event("startup")
async def on_startup():
    def _signal_handler(_signum, _frame):
        _shutdown.set()

    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)

    _workers.append(Worker(settings.QUEUE_PROOF_NAME, process_queue_proof, {"connection": settings.REDIS_URL}))
    _workers.append(Worker(settings.EXTRACTION_QUEUE_NAME, process_extraction, {"connection": settings.REDIS_URL}))

    async def _waiter():
        await _shutdown.wait()
        for w in _workers:
            await w.close()

    asyncio.create_task(_waiter())

