import json


async def process_queue_proof(job, _job_token):
    payload = {
        "event": "queue_proof.received",
        "queue": getattr(getattr(job, "queue", None), "name", None),
        "jobId": job.id,
        "jobName": job.name,
        "data": job.data,
    }
    print(json.dumps(payload), flush=True)

    return {"processedBy": "python-worker", "echo": job.data}

