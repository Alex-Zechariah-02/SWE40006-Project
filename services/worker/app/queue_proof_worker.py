import asyncio
import json
import os
import signal

from bullmq import Worker


async def process(job, job_token):
    payload = {
        "event": "queue_proof.received",
        "queue": getattr(getattr(job, "queue", None), "name", None),
        "jobId": job.id,
        "jobName": job.name,
        "data": job.data,
    }
    print(json.dumps(payload), flush=True)

    return {"processedBy": "python-worker", "echo": job.data}


async def main():
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    queue_name = os.getenv("QUEUE_PROOF_NAME", "queue_proof")

    shutdown_event = asyncio.Event()

    def signal_handler(_signum, _frame):
        shutdown_event.set()

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    worker = Worker(queue_name, process, {"connection": redis_url})

    await shutdown_event.wait()
    await worker.close()


if __name__ == "__main__":
    asyncio.run(main())
