import json
import multiprocessing
import os
from dotenv import load_dotenv

from config import SERVER_SETTING_PATH

load_dotenv()

path = SERVER_SETTING_PATH
with open(path) as r:
    settings = json.load(r)


name = "gunicorn config for uitm schedule"
accesslog = "{host_path}/gunicorn-access.log".format(**settings)
errorlog = "{host_path}/gunicorn-error.log".format(**settings)

bind = "{host}:{port}".format(**settings)

worker_class = "uvicorn.workers.UvicornWorker"
workers = multiprocessing.cpu_count() * 2 + 1
worker_connections = 1024
backlog = 2048
max_requests = 5120
timeout = 120
keepalive = 2

debug = os.environ.get("debug", "false") == "true"
reload = debug
preload_app = False
daemon = False
