from pathlib import Path

from fastapi import FastAPI
from starlette.requests import Request
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates

from handlers.fetcher import Handler
from handlers.model import CampusParams, CourseParams

templates = Jinja2Templates(directory="templates")


class Web(FastAPI):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.handler = Handler()


app = Web()
app.mount(
    "/static",
    StaticFiles(directory=Path(__file__).parent.parent.absolute() / "static"),
    name="static",
)


@app.get('/api/campuses')
async def get_campus_list():
    return await app.handler.fetch_campus_list()


@app.post('/api/courses')
async def get_campus_subjects(campus: CampusParams):
    return await app.handler.fetch_campus_courses(campus.branch)


@app.post('/api/course')
async def get_subject(params: CourseParams):
    return await app.handler.fetch_course(params.branch, params.course)


@app.get("/")
@app.get("/index")
async def serve_branch(request: Request):
    payload = {
        "request": request,
        "branches": await get_campus_list()
    }

    return templates.TemplateResponse("index.html", payload)


@app.get("/about")
async def serve_about(request: Request):
    return templates.TemplateResponse("about.html", {"request": request})